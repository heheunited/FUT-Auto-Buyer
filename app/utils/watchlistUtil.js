import {
  idAbMaxBid,
  idAutoBuyerFoundLog,
  idProgressAutobuyer,
} from "../elementIds.constants";
import { getValue, setValue } from "../services/repository";
import {
  convertToSeconds,
  formatString,
  getRandWaitTime, getRandWaitTimeInSeconds,
  promisifyTimeOut,
  wait,
} from "./commonUtil";
import { getSellPriceFromFutBin } from "./futbinUtil";
import { writeToLog } from "./logUtil";
import { sendPinEvents } from "./notificationUtil";
import {calculateProfitPercent, getBuyBidPrice, getFutBinPlayerPrice, getSellBidPrice} from "./priceUtils";
import {buyPlayer, isBidOrBuyMakeExpectedProfit} from "./purchaseUtil";
import { updateProfit } from "./statsUtil";
import {
  increaseTotalLosedTransferListCount,
  increaseSentToTransferListCount,
  increaseEstimatedProfit,
  increaseOutbidPlayerRequestsCount,
  increaseListPlayerRequestCount,
  increaseRemovePlayerRequestCount
} from "./transferListStatsUtils";

const sellBids = new Set();

export const watchListUtil = function (buyerSetting) {
  sendPinEvents("Transfer Targets - List View");

  return new Promise((resolve) => {
    services.Item.clearTransferMarketCache();

    services.Item.requestWatchedItems().observe(this, function (t, response) {
      let bidPrice = buyerSetting["idAbMaxBid"];
      let sellPrice = buyerSetting["idAbSellPrice"];
      let delayAfterOutbid = buyerSetting['idAbDelayAfterOutbid'];
      let expectedProfitPercent = buyerSetting["idAbExpectedProfitInPercent"];
      let isExpectedProfitInPercentProvided = expectedProfitPercent > 0;
      let idBuyFutBinPercent = buyerSetting['idBuyFutBinPercent'];

      let activeItems = response.data.items.filter(function (item) {
        return item._auction && item._auction._tradeState === "active";
      });

      if (!activeItems.length) {
        return resolve();
      }

      services.Item.refreshAuctions(activeItems).observe(
        this,
        function (t, refreshResponse) {
          services.Item.requestWatchedItems().observe(
            this,
            async function (t, watchResponse) {
              const isAutoBuyerActive = getValue("autoBuyerActive");
              const filterName = getValue("currentFilter");
              const bidItemsByFilter = getValue("filterBidItems") || new Map();
              const filterWatchList =
                bidItemsByFilter.get(filterName) || new Set();

              const userWatchItems = getValue("userWatchItems");
              if (isAutoBuyerActive && bidPrice) {
                let outBidItems = watchResponse.data.items.filter(function (item) {
                  let auction = item._auction;

                  let isNeedTryBidOnItemIfMaxBidSettingProvided = bidPrice > (auction.currentBid || auction.startingBid);
                  let expireTimeLessThan = auction.expires < buyerSetting['idAbBidExpiresLessThanSeconds'];

                  return (
                      auction._bidState === "outbid" &&
                      (!filterName || filterWatchList.has(auction.tradeId)) &&
                      !userWatchItems.has(auction.tradeId) &&
                      auction._tradeState === "active" &&
                      isNeedTryBidOnItemIfMaxBidSettingProvided &&
                      expireTimeLessThan
                  );
                }).sort((a, b) => a._auction.expires - b._auction.expires);

                for (var i = 0; i < outBidItems.length; i++) {
                  const currentItem = outBidItems[i];
                  let auction = currentItem._auction;
                  let currentBid = auction.currentBid || auction.startingBid;

                  let checkPrice = buyerSetting["idAbBidExact"]
                      ? bidPrice
                      : auction.currentBid
                          ? getBuyBidPrice(currentBid)
                          : currentBid;

                  if (checkPrice > bidPrice) {
                    continue;
                  }

                  if (
                      isExpectedProfitInPercentProvided &&
                      !isBidOrBuyMakeExpectedProfit(
                          null,
                          checkPrice,
                          getFutBinPlayerPrice(currentItem.definitionId, 95),
                          expectedProfitPercent
                      )
                  ) {
                    writeToLog(
                        `[???] Outbid does not make excepted profit percent: ${expectedProfitPercent}%. Player: ${currentItem._staticData.name}. Bid: ${checkPrice}. FB price: ${getFutBinPlayerPrice(currentItem.definitionId)}`,
                        idProgressAutobuyer
                    );
                    continue;
                  }

                  if (delayAfterOutbid != '0') {
                    await wait(getRandWaitTimeInSeconds(delayAfterOutbid));
                  }

                  await tryBidItems(
                    currentItem,
                    bidPrice,
                    sellPrice,
                    buyerSetting
                  );
                }
              }

              const useFutBinPrice = buyerSetting["idSellFutBinPrice"];

              if (
                isAutoBuyerActive &&
                !buyerSetting["idAbDontMoveWon"] &&
                ((sellPrice && !isNaN(sellPrice)) || useFutBinPrice)
              ) {
                let boughtItems = watchResponse.data.items.filter(function (
                  item
                ) {
                  return (
                    item.getAuctionData().isWon() &&
                    (!filterName ||
                      filterWatchList.has(item._auction.tradeId)) &&
                    !userWatchItems.has(item._auction.tradeId) &&
                    !sellBids.has(item._auction.tradeId)
                  );
                });

                for (var i = 0; i < boughtItems.length; i++) {
                  const player = boughtItems[i];
                  const price = player._auction.currentBid;
                  const ratingThreshold = buyerSetting["idSellRatingThreshold"];
                  let playerRating = parseInt(player.rating);
                  const isValidRating =
                    !ratingThreshold || playerRating <= ratingThreshold;

                  if (isValidRating && useFutBinPrice) {
                    let playerName = formatString(player._staticData.name, 15);
                    sellPrice = await getSellPriceFromFutBin(
                      buyerSetting,
                      playerName,
                      player
                    );
                  }

                  const checkBuyPrice = buyerSetting["idSellCheckBuyPrice"];
                  if (checkBuyPrice && price > (sellPrice * 95) / 100) {
                    sellPrice = -1;
                  }

                  const shouldList =
                    sellPrice && !isNaN(sellPrice) && isValidRating;

                  if (sellPrice < 0) {
                    services.Item.move(player, ItemPile.TRANSFER);
                  } else if (shouldList) {
                    const profit =
                      sellPrice * 0.95 - player._auction.currentBid;
                    updateProfit(profit);

                    await wait(getRandWaitTimeInSeconds(buyerSetting['idAbWaitTime']))

                    await sellWonItems(
                      player,
                      sellPrice,
                      buyerSetting["idAbWaitTime"],
                      buyerSetting["idFutBinDuration"],
                      profit
                    );
                  } else {
                    services.Item.move(player, ItemPile.CLUB);
                  }
                }
              }

              let expiredItems = watchResponse.data.items.filter((item) => {
                var t = item.getAuctionData();
                return t.isExpired() || (t.isClosedTrade() && !t.isWon());
              });

              if (buyerSetting["idAutoClearExpired"] && expiredItems.length) {
                increaseRemovePlayerRequestCount();
                services.Item.untarget(expiredItems);
                writeToLog(
                  `Found ${expiredItems.length} expired items and removed from watchlist`,
                  idAutoBuyerFoundLog
                );

                let userMaxBid = buyerSetting['idAbMaxBid'];
                let countExpiredItemsWithCurrentBidLessThanUserMaxBid = expiredItems.filter((player) => {
                      let playerAuction = player._auction;
                      let currentBid = (playerAuction.currentBid || playerAuction.startingBid);

                      return currentBid <= userMaxBid;
                    }
                ).length

                let countExpiredItemsWithCurrentBidGreaterThanUserMaxBid = expiredItems.length - countExpiredItemsWithCurrentBidLessThanUserMaxBid;

                increaseTotalLosedTransferListCount(
                    countExpiredItemsWithCurrentBidLessThanUserMaxBid,
                    countExpiredItemsWithCurrentBidGreaterThanUserMaxBid
                );

                expiredItems.map(player => {
                  let auction = player._auction;
                  let currentBid = (auction.currentBid || auction.startingBid);

                  writeToLog(
                      `[---] Removed Player: ${player._staticData.name}. Last Bid: ${currentBid}. FB price: ${getFutBinPlayerPrice(player.definitionId)}.`,
                      idProgressAutobuyer
                  );
                })
              }

              services.Item.clearTransferMarketCache();
              resolve();
            }
          );
        }
      );
    });
  });
};

export const addUserWatchItems = () => {
  return new Promise((resolve, reject) => {
    services.Item.requestWatchedItems().observe(this, function (t, response) {
      if (response.success) {
        const userWatchItems =
          response.data.items
            .filter((item) => item._auction)
            .map((item) => item._auction.tradeId) || [];

        setValue("userWatchItems", new Set(userWatchItems));

        if (userWatchItems.length) {
          writeToLog(
            `Found ${userWatchItems.length} items in users watch list and ignored from selling`,
            idAutoBuyerFoundLog
          );
        }
      }
      resolve();
    });
  });
};

const tryBidItems = async (player, bidPrice, sellPrice, buyerSetting) => {
  let auction = player._auction;
  let isBid = auction.currentBid;
  let currentBid = auction.currentBid || auction.startingBid;
  let playerName = formatString(player._staticData.name, 15);
  const isAutoBuyerActive = getValue("autoBuyerActive");

  let priceToBid = buyerSetting["idAbBidExact"]
    ? bidPrice
    : isBid
    ? getSellBidPrice(bidPrice)
    : bidPrice;

  let checkPrice = buyerSetting["idAbBidExact"]
    ? bidPrice
    : isBid
    ? getBuyBidPrice(currentBid)
    : currentBid;

  if (isAutoBuyerActive && currentBid <= priceToBid) {
    writeToLog(
        `[@@@] Try to outbid. Player: ${player._staticData.name}. Bid: ${checkPrice}. FB price: ${getFutBinPlayerPrice(player.definitionId)}.`,
        idProgressAutobuyer
    );
    increaseOutbidPlayerRequestsCount();
    await buyPlayer(player, playerName, checkPrice, sellPrice);
    buyerSetting["idAbAddBuyDelay"] && (await wait(1));
  }
};

const sellWonItems = async (
  player,
  sellPrice,
  waitRange,
  sellDuration,
  profit
) => {
  let auction = player._auction;
  let playerName = formatString(player._staticData.name, 14);
  sellBids.add(auction.tradeId);
  writeToLog(
    " ($$$) " +
      playerName +
      "[" +
      player._auction.tradeId +
      "] -- Selling for: " +
      sellPrice + `. FB price: ${getFutBinPlayerPrice(player.definitionId)}` +
      ". Profit: " +
      profit,
    idProgressAutobuyer
  );
  player.clearAuction();
  increaseSentToTransferListCount();
  increaseEstimatedProfit(profit);
  increaseListPlayerRequestCount();

  await promisifyTimeOut(function () {
    services.Item.list(
      player,
      getSellBidPrice(sellPrice),
      sellPrice,
      convertToSeconds(sellDuration || "1H") || 3600
    );
  }, getRandWaitTime(waitRange));
};
