import {idProgressAutobuyer, idSellFutBinPercent} from "../elementIds.constants";
import {getStatsValue, getTransferListTotalItemsCount, updateStats} from "../handlers/statsProcessor";
import {writeToLog} from "./logUtil";
import {sendPinEvents, sendUINotification} from "./notificationUtil";
import {updateUserCredits} from "./userUtil";
import {getBuyerSettings, getValue, setValue} from "../services/repository";
import {addFutbinCachePrice} from "./futbinUtil";
import {listForPrice} from "./sellUtil";
import {getRandWaitTimeInSeconds, wait} from "./commonUtil";
import {saveStatisticAboutTransferListPlayers} from "./api/transferListPlayers";
import {
    TRANSFER_LIST_MAX_COUNT,
    TRANSFER_LIST_OVERFLOWED,
    TRANSFER_LIST_TOTAL_ITEMS_COUNT, WAIT_STATUS_REQUEST_COUNTER, WAIT_UNTIL_PROCESSED_STATUS,
    WAIT_UNTIL_WAIT_STATUS,
    WAIT_UNTIL_WATCH_LIST_WILL_BE_EMPTY,
    WATCH_LIST_MAX_COUNT,
    WATCH_LIST_OVERFLOWED
} from "./constants";
import {pauseBotIfRequired, stopBotIfRequired} from "./autoActionsUtil";

export const transferListUtil = function (relistUnsold, minSoldCount, isNeedReListWithUpdatedPrice) {
    sendPinEvents("Transfer List - List View");
    return new Promise((resolve) => {
        services.Item.requestTransferItems().observe(
            this,
            async function (t, response) {
                let soldItemsList = response.response.items.filter(function (item) {
                    return item.getAuctionData().isSold();
                })
                let soldItems = soldItemsList.length;
                if (getStatsValue("soldItems") < soldItems) {
                    await updateUserCredits();
                }
                updateStats("soldItems", soldItems);

                const unsoldItems = response.response.items.filter(function (item) {
                    return (
                        !item.getAuctionData().isSold() && item.getAuctionData().isExpired()
                    );
                }).length;
                updateStats("unsoldItems", unsoldItems);

                const shouldClearSold = soldItems >= minSoldCount;

                if (unsoldItems && relistUnsold && !isNeedReListWithUpdatedPrice) {
                    services.Item.relistExpiredAuctions().observe(
                        this,
                        function (t, listResponse) {
                            !shouldClearSold &&
                            UTTransferListViewController.prototype.refreshList();
                        }
                    );
                }

                if (unsoldItems && !relistUnsold && isNeedReListWithUpdatedPrice) {
                    await reListWithUpdatedPrice(
                        response.response.items.filter((item) => {
                                return (
                                    !item.getAuctionData().isSold() && item.getAuctionData().isExpired()
                                );
                            }
                        ))
                }

                const activeTransfers = response.response.items.filter(function (item) {
                    return item.getAuctionData().isSelling();
                }).length;
                updateStats("activeTransfers", activeTransfers);

                const availableItems = response.response.items.filter(function (item) {
                    return item.getAuctionData().isInactive();
                }).length;

                updateStats("availableItems", availableItems);

                const userCoins = services.User.getUser().coins.amount;
                updateStats("coinsNumber", userCoins);
                updateStats("coins", userCoins.toLocaleString());

                if (shouldClearSold) {
                    let totalProfit = 0;

                    soldItemsList.map((player) => {
                        const auction = player.getAuctionData();

                        totalProfit += (auction.currentBid || auction.startingBid);
                    })


                    writeToLog("[⍟⍟⍟] CLEAR TRANSFER LIST. SOLD ITEMS COUNT: " + soldItems + `. PROFIT: ${totalProfit}.`, idProgressAutobuyer, "\n");
                    updateStats('lastProfit', totalProfit);

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
    let sellPercent = buyerSetting["idSellFutBinPercent"];

    if (items.length > 0) {
        writeToLog("[↺↺↺] RELIST UNSOLD ITEMS COUNT: " + items.length + `. DURATION: ${buyerSetting['idFutBinDuration']}.`, idProgressAutobuyer, "\n")
    }

    await addFutbinCachePrice(items);
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

        await listForPrice(playerPrice, player, sellPercent);
        await wait(getRandWaitTimeInSeconds(buyerSetting['idAbRelistSellItemsWaitTime']));
    }
}

export const setTransferListTotalItemsCountInterval = () => {
    setInterval(() => {
        sendPinEvents("Transfer List - List View");
        return new Promise((resolve) => {
            services.Item.requestTransferItems().observe(this, async (t, response) => {
                    setValue(TRANSFER_LIST_TOTAL_ITEMS_COUNT, response.response.items.length);
                    setValue(TRANSFER_LIST_OVERFLOWED, response.response.items.length >= TRANSFER_LIST_MAX_COUNT);

                    return resolve();
                }
            );
        });
    }, 30000)
}

export const setWatchListTotalItemsCountInterval = () => {
    setInterval(() => {
        sendPinEvents("Transfer List - List View");
        return new Promise((resolve) => {
            services.Item.requestWatchedItems().observe(this, (t, response) => {
                    setValue(WATCH_LIST_OVERFLOWED, response.response.items.length >= WATCH_LIST_MAX_COUNT);

                    return resolve();
                }
            );
        });
    }, 40000)
}
