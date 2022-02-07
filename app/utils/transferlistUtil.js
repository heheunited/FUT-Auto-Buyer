import {idProgressAutobuyer, idSellFutBinPercent} from "../elementIds.constants";
import { getStatsValue, updateStats } from "../handlers/statsProcessor";
import { writeToLog } from "./logUtil";
import { sendPinEvents } from "./notificationUtil";
import { updateUserCredits } from "./userUtil";
import {getBuyerSettings, getValue, setValue} from "../services/repository";
import {addFutbinCachePrice} from "./futbinUtil";
import {listForPrice} from "./sellUtil";
import {getRandWaitTimeInSeconds, wait} from "./commonUtil";
import {saveStatisticAboutTransferListPlayers} from "./api/transferListPlayers";

export const transferListUtil = function (relistUnsold, minSoldCount, isNeedReListWithUpdatedPrice) {
  sendPinEvents("Transfer List - List View");
  return new Promise((resolve) => {
    services.Item.requestTransferItems().observe(
      this,
      async function (t, response) {
          let soldItemsList = response.data.items.filter(function (item) {
              return item.getAuctionData().isSold();
          })
          let soldItems = soldItemsList.length;
        if (getStatsValue("soldItems") < soldItems) {
          await updateUserCredits();
        }
        updateStats("soldItems", soldItems);

        const unsoldItems = response.data.items.filter(function (item) {
          return (
            !item.getAuctionData().isSold() && item.getAuctionData().isExpired()
          );
        }).length;
        updateStats("unsoldItems", unsoldItems);

        const shouldClearSold = soldItems >= minSoldCount;

          if (unsoldItems && !relistUnsold && isNeedReListWithUpdatedPrice) {
              setValue('shouldRelistAfterFbPrice', false);
              await reListWithUpdatedPrice(
                  response.data.items.filter((item) => {
                          return (
                              !item.getAuctionData().isSold() && item.getAuctionData().isExpired()
                          );
                      }
                  ))
          }

          if ((unsoldItems && relistUnsold && !isNeedReListWithUpdatedPrice) || (getValue('shouldRelistAfterFbPrice') === true)) {
              services.Item.relistExpiredAuctions().observe(
                  this,
                  function (t, listResponse) {
                      !shouldClearSold &&
                      UTTransferListViewController.prototype.refreshList();
                  }
              );
          }

        const activeTransfers = response.data.items.filter(function (item) {
          return item.getAuctionData().isSelling();
        }).length;
        updateStats("activeTransfers", activeTransfers);

        const availableItems = response.data.items.filter(function (item) {
          return item.getAuctionData().isInactive();
        }).length;

        updateStats("availableItems", availableItems);

        const userCoins = services.User.getUser().coins.amount;
        updateStats("coinsNumber", userCoins);
        updateStats("coins", userCoins.toLocaleString());

        if (shouldClearSold) {
          writeToLog(
            "[TRANSFER-LIST] > " + soldItems + " item(s) sold\n",
            idProgressAutobuyer
          );
          UTTransferListViewController.prototype._clearSold();
          saveStatisticAboutTransferListPlayers(soldItemsList);
        }
        resolve();
      }
    );
  });
};

export const reListWithUpdatedPrice = async (items) => {
    const buyerSetting = getBuyerSettings();
    let sellPercent = buyerSetting["idSellFutBinPercent"]

    await addFutbinCachePrice(items)
    for (var itmIndex = 0; itmIndex < items.length; itmIndex++) {
        let player = items[itmIndex];
        let existingValue = getValue(player.definitionId);

        if (!existingValue || !existingValue.price) {
            continue;
        }

        let playerPrice = existingValue.price;

        let userMinimalSellPrice = buyerSetting['idAbMinSellPrice'];
        if (userMinimalSellPrice != 0) {
            playerPrice = playerPrice >= userMinimalSellPrice ? playerPrice : userMinimalSellPrice;
        }

        await listForPrice(playerPrice, player, sellPercent)
        await wait(getRandWaitTimeInSeconds('3-8'));
    }
}
