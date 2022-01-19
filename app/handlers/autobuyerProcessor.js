import { STATE_ACTIVE, STATE_PAUSED, STATE_STOPPED } from "../app.constants";
import {
  idAbStatus,
  idAutoBuyerFoundLog,
  idProgressAutobuyer,
} from "../elementIds.constants";
import {
  getBuyerSettings,
  getValue,
  increAndGetStoreValue,
  setValue,
} from "../services/repository";
import {
  pauseBotIfRequired,
  stopBotIfRequired,
  switchFilterIfRequired,
} from "../utils/autoActionsUtil";
import {
  convertRangeToSeconds,
  convertToSeconds,
  formatString,
  getRandNum,
  getRangeValue,
  playAudio,
} from "../utils/commonUtil";
import { addFutbinCachePrice } from "../utils/futbinUtil";
import { writeToDebugLog, writeToLog } from "../utils/logUtil";
import {
  sendErrorNotificationToUser,
  sendNotificationToUser,
  sendPinEvents,
  sendUINotification
} from "../utils/notificationUtil";
import {
  getBuyBidPrice,
  getSellBidPrice,
  roundOffPrice,
} from "../utils/priceUtils";
import {buyPlayer, checkRating, isBidOrBuyMakeExpectedProfit} from "../utils/purchaseUtil";
import { updateRequestCount } from "../utils/statsUtil";
import { setRandomInterval } from "../utils/timeOutUtil";
import { transferListUtil } from "../utils/transferlistUtil";
import { addUserWatchItems, watchListUtil } from "../utils/watchlistUtil";
import { searchErrorHandler } from "./errorHandler";

let interval = null;
let passInterval = null;
const currentBids = new Set();

const sortPlayers = (playerList, sortBy, sortOrder) => {
  let sortFunc = (a) => a._auction.buyNowPrice;
  if (sortBy === "bid") {
    sortFunc = (a) => a._auction.currentBid || a._auction.startingBid;
  } else if (sortBy === "rating") {
    sortFunc = (a) => parseInt(a.rating);
  } else if (sortBy === "expires") {
    sortFunc = (a) => parseInt(a._auction.expires);
  }
  playerList.sort((a, b) => {
    const sortAValue = sortFunc(a);
    const sortBValue = sortFunc(b);
    return !sortOrder ? sortBValue - sortAValue : sortAValue - sortBValue;
  });
  return playerList;
};



export const startAutoBuyer = async function (isResume) {
  $("#" + idAbStatus)
    .css("color", "#2cbe2d")
    .html("RUNNING");

  const isActive = getValue("autoBuyerActive");
  if (isActive) return;
  sendUINotification(isResume ? "Autobuyer Resumed" : "Autobuyer Started");
  setValue("autoBuyerActive", true);
  setValue("autoBuyerState", STATE_ACTIVE);
  if (!isResume) {
    setValue("botStartTime", new Date());
    setValue("purchasedCardCount", 0);
    setValue("searchFailedCount", 0);
    setValue("currentPage", 1);
  }
  let switchFilterWithContext = switchFilterIfRequired.bind(this);
  let srchTmWithContext = searchTransferMarket.bind(this);
  let watchListWithContext = watchListUtil.bind(this);
  let transferListWithContext = transferListUtil.bind(this);
  let pauseBotWithContext = pauseBotIfRequired.bind(this);
  await switchFilterWithContext();
  let buyerSetting = getBuyerSettings();
  !isResume && (await addUserWatchItems());
  sendPinEvents("Hub - Transfers");
  await srchTmWithContext(buyerSetting);
  sendPinEvents("Hub - Transfers");
  await transferListWithContext(
    buyerSetting["idAbSellToggle"],
    buyerSetting["idAbMinDeleteCount"],
    buyerSetting["idAbRelistUnsoldWithUpdatePrice"]
  );
  let operationInProgress = false;
  if (getValue("autoBuyerActive")) {
    interval = setRandomInterval(async () => {
      passInterval = await pauseBotWithContext(buyerSetting);
      stopBotIfRequired(buyerSetting);
      const isBuyerActive = getValue("autoBuyerActive");
      if (isBuyerActive && !operationInProgress) {
        operationInProgress = true;
        await switchFilterWithContext();
        buyerSetting = getBuyerSettings();
        sendPinEvents("Hub - Transfers");
        await srchTmWithContext(buyerSetting);
        sendPinEvents("Hub - Transfers");
        await watchListWithContext(buyerSetting);
        sendPinEvents("Hub - Transfers");
        await transferListWithContext(
          buyerSetting["idAbSellToggle"],
          buyerSetting["idAbMinDeleteCount"]
        );
        operationInProgress = false;
      }
    }, ...getRangeValue(buyerSetting["idAbWaitTime"]));
  }
};

export const autoRestartAutoBuyer = () => {
  let buyerSetting = getBuyerSettings();
  if (buyerSetting["idAbRestartAfter"]){
    const autoRestart = convertRangeToSeconds(
        buyerSetting["idAbRestartAfter"]
    );
    setTimeout(() => {
      const isActive = getValue("autoBuyerActive");
      if (isActive) return;
      startAutoBuyer.call(getValue("AutoBuyerInstance")); //Dieses True evtl wieder entfernen HIER HIER HIER
      writeToLog(
          `Autobuyer automatically restarted.`,
          idProgressAutobuyer
      );

      sendErrorNotificationToUser('Autobuyer automatically restarted.')
    }, autoRestart * 1000);
  }
};

export const stopAutoBuyer = (isPaused) => {

  interval && interval.clear();
  if (!isPaused && passInterval) {
    clearTimeout(passInterval);
  }
  const state = getValue("autoBuyerState");
  if (
    (isPaused && state === STATE_PAUSED) ||
    (!isPaused && state === STATE_STOPPED)
  ) {
    return;
  }
  setValue("autoBuyerActive", false);
  setValue("searchInterval", {
    ...getValue("searchInterval"),
    end: Date.now(),
  });
  if (!isPaused) {
    playAudio("finish");
  }
  setValue("autoBuyerState", isPaused ? STATE_PAUSED : STATE_STOPPED);
  sendUINotification(isPaused ? "Autobuyer Paused" : "Autobuyer Stopped");
  $("#" + idAbStatus)
    .css("color", "red")
    .html(isPaused ? "PAUSED" : "IDLE");
};

const searchTransferMarket = function (buyerSetting) {
  return new Promise((resolve) => {
    const expiresIn = convertToSeconds(buyerSetting["idAbItemExpiring"]);
    const useRandMinBid = buyerSetting["idAbRandMinBidToggle"];
    const useRandMinBuy = buyerSetting["idAbRandMinBuyToggle"];
    const futBinBuyPercent = buyerSetting["idBuyFutBinPercent"] || 100;
    let currentPage = getValue("currentPage") || 1;
    const playersList = new Set(
      (buyerSetting["idAddIgnorePlayersList"] || []).map(({ id }) => id)
    );

    let bidPrice = buyerSetting["idAbMaxBid"];
    let userBuyNowPrice = buyerSetting["idAbBuyPrice"];
    let useFutBinPrice = buyerSetting["idBuyFutBinPrice"];

    let userFutBinMinimalPrice = buyerSetting["idAbBuyFutMinimalPrice"];
    let isUserFutBinMinimalPriceProvided = userFutBinMinimalPrice > 0;

    let expectedProfitInPercent = buyerSetting['idAbExpectedProfitInPercent'];
    let isExpectedProfitInPercentProvided = expectedProfitInPercent > 0;

    if (!userBuyNowPrice && !bidPrice && !useFutBinPrice) {
      writeToLog(
        "skip search >>> (No Buy or Bid Price given)",
        idAutoBuyerFoundLog
      );
      return resolve();
    }

    sendPinEvents("Transfer Market Search");
    updateRequestCount();
    let searchCriteria = this._viewmodel.searchCriteria;
    if (useRandMinBid)
      searchCriteria.minBid = roundOffPrice(
        getRandNum(0, buyerSetting["idAbRandMinBidInput"])
      );
    if (useRandMinBuy)
      searchCriteria.minBuy = roundOffPrice(
        getRandNum(0, buyerSetting["idAbRandMinBuyInput"])
      );
    services.Item.clearTransferMarketCache();

    services.Item.searchTransferMarket(searchCriteria, currentPage).observe(
      this,
      async function (sender, response) {
        if (response.success) {
          setValue("searchFailedCount", 0);
          let validSearchCount = true;
          writeToLog(
            `= Received ${response.data.items.length} items - from page (${currentPage}) => config: (minbid: ${searchCriteria.minBid}-minbuy:${searchCriteria.minBuy})`,
            idAutoBuyerFoundLog
          );

          if (response.data.items.length > 0) {
            writeToLog(
              "| rating   | player name     | bid    | buy    | time            | action",
              idAutoBuyerFoundLog
            );
            currentPage === 1 &&
              sendPinEvents("Transfer Market Results - List View");
            if (response.data.items[0].type === "player") {
              await addFutbinCachePrice(response.data.items);
            }
          }

          if (response.data.items.length > buyerSetting["idAbSearchResult"]) {
            validSearchCount = false;
          }

          let maxPurchases = buyerSetting["idAbMaxPurchases"];
          if (
            currentPage < buyerSetting["idAbMaxSearchPage"] &&
            response.data.items.length === 21
          ) {
            increAndGetStoreValue("currentPage");
          } else {
            setValue("currentPage", 1);
          }
          if (buyerSetting["idAbShouldSort"])
            response.data.items = sortPlayers(
              response.data.items,
              buyerSetting["idAbSortBy"] || "buy",
              buyerSetting["idAbSortOrder"]
            );
          for (
            let i = response.data.items.length - 1;
            i >= 0 && getValue("autoBuyerActive");
            i--
          ) {
            let player = response.data.items[i];
            let auction = player._auction;
            let type = player.type;
            let { id } = player._metaData || {};
            let playerRating = parseInt(player.rating);
            let expires = services.Localization.localizeAuctionTimeRemaining(
              auction.expires
            );

            let currentPlayerFutBinPrice = -1;
            if (type === "player") {
              const existingValue = getValue(player.definitionId);
              if (existingValue && existingValue.price) {
                const futBinBuyPrice = roundOffPrice(
                  (existingValue.price * futBinBuyPercent) / 100
                );

                if (useFutBinPrice) {
                  userBuyNowPrice = futBinBuyPrice;
                }

                currentPlayerFutBinPrice = futBinBuyPrice;

                if (buyerSetting["idAbBidFutBin"]) {
                  bidPrice = futBinBuyPrice;
                }
              } else {
                writeToLog(
                  `Error fetch fetching Price for ${player._staticData.name}`,
                  idProgressAutobuyer
                );
                continue;
              }
            }
            let buyNowPrice = auction.buyNowPrice;
            let currentBid = auction.currentBid || auction.startingBid;
            let isBid = auction.currentBid;

            let priceToBid = buyerSetting["idAbBidExact"]
              ? bidPrice
              : isBid
              ? getSellBidPrice(bidPrice)
              : bidPrice;

            let checkPrice = buyerSetting["idAbBidExact"]
              ? priceToBid
              : isBid
              ? getBuyBidPrice(currentBid)
              : currentBid;

            const isMinimalPLayerFutBinPriceCorrect = isUserFutBinMinimalPriceProvided
                ? userFutBinMinimalPrice <= currentPlayerFutBinPrice
                : false;

            let usersellPrice = buyerSetting["idAbSellPrice"];
            let minRating = buyerSetting["idAbMinRating"];
            let maxRating = buyerSetting["idAbMaxRating"];

            let bidTxt = formatString(currentBid.toString(), 6);
            let buyTxt = formatString(buyNowPrice.toString(), 6);
            let playerName = formatString(player._staticData.name, 15);
            let expireTime = formatString(expires, 15);

            const shouldCheckRating = minRating || maxRating;

            const isValidRating =
              !shouldCheckRating ||
              checkRating(playerRating, minRating, maxRating);
            const ratingTxt = !isValidRating ? "no" : "ok";

            const logWrite = writeToLogClosure(
              "(" + playerRating + "-" + ratingTxt + ") ",
              playerName,
              bidTxt,
              buyTxt,
              expireTime
            );

            if (
              (!buyerSetting["idAbIgnoreAllowToggle"] && playersList.has(id)) ||
              (buyerSetting["idAbIgnoreAllowToggle"] && !playersList.has(id))
            ) {
              logWrite("skip >>> (Ignored player)");
              continue;
            }

            if (!validSearchCount) {
              logWrite("skip >>> (Exceeded search result threshold)");
              continue;
            }

            if (maxPurchases < 1) {
              logWrite("skip >>> (Exceeded num of buys/bids per search)");
              continue;
            }

            if (!player.preferredPosition && buyerSetting["idAbAddFilterGK"]) {
              logWrite("skip >>> (is a Goalkeeper)");
              continue;
            }

            if (!isValidRating) {
              logWrite("skip >>> (rating does not fit criteria)");
              continue;
            }

            if (currentBids.has(auction.tradeId)) {
              logWrite("skip >>> (Cached Item)");
              continue;
            }

            if (isUserFutBinMinimalPriceProvided && !isMinimalPLayerFutBinPriceCorrect) {
              logWrite("skip >>> (min futbin price > player futbin price)");
              continue;
            }

            if (
                isExpectedProfitInPercentProvided &&
                !isBidOrBuyMakeExpectedProfit(
                userBuyNowPrice,
                checkPrice,
                currentPlayerFutBinPrice,
                expectedProfitInPercent
            )
            ) {
              logWrite(`skip >>> (Bid or Buy dont make expected profit: ${expectedProfitInPercent}%)`);
              continue;
            }

            const userCoins = services.User.getUser().coins.amount;
            if (
              userCoins < buyNowPrice ||
              (bidPrice && userCoins < checkPrice)
            ) {
              logWrite("skip >>> (Insufficient coins to buy/bid)");
              continue;
            }

            if (buyNowPrice <= userBuyNowPrice) {
              maxPurchases--;
              logWrite("attempt buy: " + buyNowPrice);
              currentBids.add(auction.tradeId);
              await buyPlayer(
                player,
                playerName,
                buyNowPrice,
                usersellPrice,
                true,
                auction.tradeId
              );
              continue;
            }

            if (bidPrice && currentBid <= priceToBid) {
              if (auction.expires > expiresIn) {
                logWrite("skip >>> (Waiting for specified expiry time)");
                continue;
              }
              logWrite("attempt bid: " + checkPrice);
              currentBids.add(auction.tradeId);
              maxPurchases--;
              await buyPlayer(
                player,
                playerName,
                checkPrice,
                usersellPrice,
                checkPrice === buyNowPrice,
                auction.tradeId
              );
              continue;
            }

            if (
              (userBuyNowPrice && buyNowPrice > userBuyNowPrice) ||
              (bidPrice && currentBid > priceToBid)
            ) {
              logWrite("skip >>> (higher than specified buy/bid price)");
              continue;
            }

            logWrite("skip >>> (No Actions Required)");
          }
        } else {
          searchErrorHandler(
            response,
            buyerSetting["idAbSolveCaptcha"],
            buyerSetting["idAbCloseTabToggle"]
          );
        }
        sendPinEvents("Transfer Market Search");
        resolve();
      }
    );
  });
};

const writeToLogClosure = (
  ratingTxt,
  playerName,
  bidTxt,
  buyTxt,
  expireTime
) => {
  return (actionTxt) => {
    writeToDebugLog(
      ratingTxt,
      playerName,
      bidTxt,
      buyTxt,
      expireTime,
      actionTxt
    );
  };
};
