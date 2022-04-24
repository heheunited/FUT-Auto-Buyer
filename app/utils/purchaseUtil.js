import { errorCodeLookUp } from "../app.constants";
import { idProgressAutobuyer } from "../elementIds.constants";
import { startAutoBuyer, stopAutoBuyer } from "../handlers/autobuyerProcessor";
import {
  getBuyerSettings,
  getValue,
  increAndGetStoreValue,
  setValue,
} from "../services/repository";
import {
  convertRangeToSeconds,
  convertToSeconds,
  formatString,
  getRandWaitTime, getRandWaitTimeInSeconds,
  playAudio, timeStringFormat,
  wait,
} from "./commonUtil";
import { getSellPriceFromFutBin } from "./futbinUtil";
import { writeToAbLog, writeToLog } from "./logUtil";
import {sendErrorNotificationToUser, sendNotificationToUser} from "./notificationUtil";
import {calculateProfitPercent, getFutBinPlayerPrice, getSellBidPrice} from "./priceUtils";
import { appendTransactions, updateProfit } from "./statsUtil";
import {
  increaseBidPlayerRequestsCount,
  increaseBuyPlayerRequestsCount,
  increaseTotalBuyPlayerRequestsCount
} from "./transferListStatsUtils";
import {create as saveErrorStatistic} from "./api/errorsStatistic";
import {getStatsValue} from "../handlers/statsProcessor";

export const checkRating = (
  cardRating,
  permittedRatingMin,
  permittedRatingMax
) => cardRating >= permittedRatingMin && cardRating <= permittedRatingMax;

const errorCodeCountMap = new Map();

export const buyPlayer = (
  player,
  playerName,
  price,
  sellPrice,
  isBin,
  tradeId
) => {
  const buyerSetting = getBuyerSettings();
  return new Promise((resolve) => {
    services.Item.bid(player, price).observe(
      this,
      async function (sender, data) {
        increaseTotalBuyPlayerRequestsCount();

        let priceTxt = formatString(price.toString(), 6);
        const notificationType = buyerSetting["idNotificationType"];
        let sendDetailedNotification = buyerSetting["idDetailedNotification"];
        let logMessage = "";

        if (data.success) {
          if (isBin) {
            increAndGetStoreValue("purchasedCardCount");
            playAudio("cardWon");
          }
          const ratingThreshold = buyerSetting["idSellRatingThreshold"];
          let playerRating = parseInt(player.rating);
          const isValidRating =
            !ratingThreshold || playerRating <= ratingThreshold;

          const useFutBinPrice = buyerSetting["idSellFutBinPrice"];
          if (isValidRating && useFutBinPrice && isBin) {
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

          const shouldList = sellPrice && !isNaN(sellPrice) && isValidRating;
          const profit = sellPrice * 0.95 - price;
          if (isBin) {
            let winCount = increAndGetStoreValue("winCount");
            let sym = " W:" + formatString(winCount.toString(), 4);
            appendTransactions(
              `[${new Date().toLocaleTimeString()}] ${playerName.trim()} buy success - Price : ${price}`
            );
            logMessage = writeToAbLog(
              sym,
              playerName,
              priceTxt,
              formatString(getFutBinPlayerPrice(player.definitionId).toString(), 8),
              "buy",
              "success",
              sellPrice < 0
                ? "move to transferlist"
                : shouldList
                ? "selling for: " + sellPrice + ", Profit: " + profit
                : buyerSetting["idAbDontMoveWon"]
                ? ""
                : "move to club"
            );
            increaseBuyPlayerRequestsCount();

            if (!buyerSetting["idAbDontMoveWon"]) {
              setTimeout(function () {
                if (sellPrice < 0) {
                  services.Item.move(player, ItemPile.TRANSFER);
                } else if (shouldList) {
                  updateProfit(profit);
                  services.Item.list(
                    player,
                    getSellBidPrice(sellPrice),
                    sellPrice,
                    convertToSeconds(
                      buyerSetting["idFutBinDuration"] || "1H"
                    ) || 3600
                  );
                } else {
                  services.Item.move(player, ItemPile.CLUB);
                }
              }, getRandWaitTime(buyerSetting["idAbWaitTime"]));
            }
          } else {
            let bidCount = increAndGetStoreValue("bidCount");
            let sym = " B:" + formatString(bidCount.toString(), 4);
            appendTransactions(
              `[${new Date().toLocaleTimeString()}] ${playerName.trim()} bid success - Price : ${price}`
            );
            logMessage = writeToAbLog(
                sym,
                playerName,
                priceTxt,
                formatString(getFutBinPlayerPrice(player.definitionId).toString(), 8),
                "bid",
                "success",
                "waiting to expire",
                timeStringFormat(services.Localization.localizeAuctionTimeRemaining(player._auction.expires))
            );
            increaseBidPlayerRequestsCount();
            const filterName = getValue("currentFilter");
            if (filterName) {
              const bidItemsByFilter = getValue("filterBidItems") || new Map();
              if (bidItemsByFilter.has(filterName)) {
                bidItemsByFilter.get(filterName).add(tradeId);
              } else {
                bidItemsByFilter.set(filterName, new Set([tradeId]));
              }
              setValue("filterBidItems", bidItemsByFilter);
            }
          }

          if (notificationType === "B" || notificationType === "A") {
            if (sendDetailedNotification) sendNotificationToUser(logMessage);
            else
              sendNotificationToUser(
                `|  ${playerName.trim()}  | ${priceTxt.trim()} | buy |`
              );
          }
        } else {
          // await wait(getRandWaitTimeInSeconds('3-5'))
          let lossCount = increAndGetStoreValue("lossCount");
          let sym = " L:" + formatString(lossCount.toString(), 4);
          appendTransactions(
            `[${new Date().toLocaleTimeString()}] ${playerName.trim()} buy failed - Price : ${price}`
          );
          let status = (data.error?.code || data.status) + "";

           if (status == 429 || status == 521 || status == 512) {
             let logMessage = `***Too many request from this user. Status ${status} triggered. Bot stopped.`;

             if (getStatsValue("searchCount") > 2) {
               saveErrorStatistic({code: status});
             }

             writeToLog(logMessage, idProgressAutobuyer);

             sendErrorNotificationToUser(logMessage)

             errorCodeCountMap.clear();
             stopAutoBuyer();
           }

          logMessage = writeToAbLog(
            sym,
            playerName,
            priceTxt,
            formatString(getFutBinPlayerPrice(player.definitionId).toString(), 8),
            isBin ? "buy" : "bid",
            "failure",
            `ERR: (${errorCodeLookUp[status] + "(" + status + ")" || status})`
          );
          if (notificationType === "L" || notificationType === "A") {
            if (sendDetailedNotification) sendNotificationToUser(logMessage);
            else
              sendNotificationToUser(
                `| ${playerName.trim()} | ${priceTxt.trim()} | failure |`
              );
          }

          if (buyerSetting["idAbStopErrorCode"]) {
            const errorCodes = new Set(
              buyerSetting["idAbStopErrorCode"].split(",")
            );

            if (!errorCodeCountMap.has(status))
              errorCodeCountMap.set(status, { currentVal: 0 });

            errorCodeCountMap.get(status).currentVal++;

            if (
              errorCodes.has(status) &&
              errorCodeCountMap.get(status).currentVal >=
                buyerSetting["idAbStopErrorCodeCount"]
            ) {
              logMessage = writeToLog(
                `[!!!] Autostopping bot since error code ${status} has occured ${
                  errorCodeCountMap.get(status).currentVal
                } times\n`,
                idProgressAutobuyer
              );
              errorCodeCountMap.clear();
              stopAutoBuyer();

              if (sendDetailedNotification) {
                sendNotificationToUser(logMessage);
              }

              sendErrorNotificationToUser(logMessage);

              if (buyerSetting["idAbResumeAfterErrorOccured"]) {
                const pauseFor = convertRangeToSeconds(
                  buyerSetting["idAbResumeAfterErrorOccured"]
                );

                writeToLog(
                  `Bot will resume after ${pauseFor}(s)`,
                  idProgressAutobuyer
                );
                setTimeout(() => {
                  startAutoBuyer.call(getValue("AutoBuyerInstance"));
                }, pauseFor * 1000);
              }
            }
          }
        }

        buyerSetting["idAbAddBuyDelay"] && (await wait(convertToSeconds(buyerSetting["idAbDelayToAdd"])));
        resolve();
      }
    );
  });
};

export const isBidOrBuyMakeExpectedPercentProfit = (
    userMaxBuyNow,
    priceToBid,
    futBinPrice,
    expectedProfitPercent
) => {
  if (!futBinPrice) {
    return true;
  }

  if (userMaxBuyNow && userMaxBuyNow > 0 && calculateProfitPercent(futBinPrice, userMaxBuyNow) >= expectedProfitPercent) {
    return true;
  }

  return priceToBid && priceToBid > 0 && calculateProfitPercent(futBinPrice, priceToBid) >= expectedProfitPercent;
}


