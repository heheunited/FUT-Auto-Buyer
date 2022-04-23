import {
    idAbMaxBid,
    idAutoBuyerFoundLog,
    idProgressAutobuyer,
} from "../elementIds.constants";
import {getValue, setValue} from "../services/repository";
import {
    convertToSeconds,
    formatString,
    getRandWaitTimeInSeconds, getRangeValue, setWaitTimeObj,
    wait,
} from "./commonUtil";
import {getSellPriceFromFutBin} from "./futbinUtil";
import {writeToLog} from "./logUtil";
import {sendPinEvents, sendUINotification} from "./notificationUtil";
import {getBuyBidPrice, getFutBinPlayerPrice, getSellBidPrice} from "./priceUtils";
import {buyPlayer, isBidOrBuyMakeExpectedProfit} from "./purchaseUtil";
import {updateProfit} from "./statsUtil";
import {
    increaseTotalLosedTransferListCount,
    increaseSentToTransferListCount,
    increaseEstimatedProfit,
    increaseOutbidPlayerRequestsCount,
    increaseListPlayerRequestCount,
    increaseRemovePlayerRequestCount
} from "./transferListStatsUtils";
import {
    SELL_MOD_AFTER_BOT_PAUSE,
    SELL_MOD_AUTO_DEFAULT,
    SELL_MOD_BY_COUNT,
    SELL_MOD_DISABLED,
    TRANSFER_LIST_MAX_COUNT
} from "./constants";
import {getTransferListTotalItemsCount, updateStats} from "../handlers/statsProcessor";

const sellBids = new Set();
const outbidLimitPerPlayerMap = new Map();

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
            let isIssetOutbidLimitPerPlayer = buyerSetting['idAbBidLimitPerPlayer'] > 0;
            let watchlistPlayerLimit = buyerSetting['idAbWatchlistPlayersLimit'];

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
                            // const filterName = getValue("currentFilter");
                            // const bidItemsByFilter = getValue("filterBidItems") || new Map();
                            // const filterWatchList = bidItemsByFilter.get(filterName) || new Set();

                            const userWatchItems = getValue("userWatchItems");
                            if (isAutoBuyerActive && bidPrice) {

                                if (watchlistPlayerLimit > 0) {
                                    let watchListItemsCount = watchResponse.data.items.filter((item) => {
                                        let auction = item._auction;
                                        let tAuction = item.getAuctionData();
                                        let currentBid = (auction.currentBid || auction.startingBid);

                                        let checkPrice = buyerSetting["idAbBidExact"]
                                            ? bidPrice
                                            : auction.currentBid
                                                ? getBuyBidPrice(currentBid)
                                                : currentBid;

                                        let expectedPercentProfit = isExpectedProfitInPercentProvided
                                            ? isBidOrBuyMakeExpectedProfit(
                                                null,
                                                checkPrice,
                                                getFutBinPlayerPrice(item.definitionId, 95),
                                                expectedProfitPercent
                                            )
                                            : true;

                                        let isOutbidLimitValid = isIssetOutbidLimitPerPlayer
                                            ? isOutbidAttemptLimitPerPlayerNotExceeded(buyerSetting['idAbBidLimitPerPlayer'], auction.tradeId)
                                            : true;

                                        return (
                                            !tAuction.isExpired() && !tAuction.isClosedTrade() && !tAuction.isWon() &&
                                            isOutbidLimitValid &&
                                            bidPrice > currentBid &&
                                            expectedPercentProfit &&
                                            bidPrice > checkPrice
                                        );
                                    }).length;

                                    controlWatchlistPlayerLimitState(buyerSetting, watchListItemsCount);
                                }

                                let outBidItems = watchResponse.data.items.filter((item) => {
                                    let auction = item._auction;
                                    let currentBid = (auction.currentBid || auction.startingBid);

                                    let checkPrice = buyerSetting["idAbBidExact"]
                                        ? bidPrice
                                        : auction.currentBid
                                            ? getBuyBidPrice(currentBid)
                                            : currentBid;

                                    let expectedPercentProfit = isExpectedProfitInPercentProvided
                                        ? isBidOrBuyMakeExpectedProfit(
                                            null,
                                            checkPrice,
                                            getFutBinPlayerPrice(item.definitionId, 95),
                                            expectedProfitPercent
                                        )
                                        : true;

                                    let expireTimeLessThan = buyerSetting['idAbBidExpiresLessThanSeconds'] > 0
                                        ? auction.expires <= buyerSetting['idAbBidExpiresLessThanSeconds']
                                        : true;

                                    let isOutbidLimitValid = isIssetOutbidLimitPerPlayer
                                        ? isOutbidAttemptLimitPerPlayerNotExceeded(buyerSetting['idAbBidLimitPerPlayer'], auction.tradeId)
                                        : true;

                                    return (
                                        auction._bidState === "outbid" &&
                                        auction._tradeState === "active" &&
                                        isOutbidLimitValid &&
                                        bidPrice > currentBid &&
                                        expireTimeLessThan &&
                                        expectedPercentProfit &&
                                        bidPrice > checkPrice
                                    );
                                }).sort((a, b) => a._auction.expires - b._auction.expires);

                                for (var i = 0; i < outBidItems.length; i++) {
                                    const currentItem = outBidItems[i];

                                    if (isIssetOutbidLimitPerPlayer) {
                                        increaseOutbidPerPlayerAttemptCount(currentItem._auction.tradeId)
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
                            const sellMod = getSellWonItemsMod(buyerSetting);

                            if (sellMod !== SELL_MOD_DISABLED) {
                                let boughtItems = watchResponse.data.items.filter(function (item) {
                                    return (
                                        item.getAuctionData().isWon() &&
                                        // (!filterName || filterWatchList.has(item._auction.tradeId)) &&
                                        !userWatchItems.has(item._auction.tradeId) &&
                                        !sellBids.has(item._auction.tradeId)
                                    );
                                });

                                const isNeedSellWonItemsByCount = sellMod === SELL_MOD_BY_COUNT && boughtItems.length >= buyerSetting['idAbSellWonItemsCount'];
                                const isNeedSellWonItemsAfterBotPause = sellMod === SELL_MOD_AFTER_BOT_PAUSE && getValue('needSellWonItemsAfterBotPause') === true;
                                const isNeedSendToTransferList = sellMod === SELL_MOD_AUTO_DEFAULT && !isNeedSellWonItemsByCount && !isNeedSellWonItemsAfterBotPause;

                                if (isNeedSellWonItemsAfterBotPause || isNeedSellWonItemsByCount || isNeedSendToTransferList) {
                                    let itemsLength = boughtItems.length;

                                    if (buyerSetting['idAbPreventTransferListOverflow']) {
                                        let totalItemsCount = getTransferListTotalItemsCount();

                                        itemsLength = (totalItemsCount + itemsLength) <= TRANSFER_LIST_MAX_COUNT
                                            ? itemsLength
                                            : ((TRANSFER_LIST_MAX_COUNT - totalItemsCount) - 1);

                                        if (itemsLength !== boughtItems.length) {
                                            writeToLog(`PREVENT TRANSFER LIST OVERFLOW ACTIVATED. OLD ITEMS COUNT: ${boughtItems.length}. NEW ITEMS COUNT: ${itemsLength >= 0 ? itemsLength : 0}.`, idProgressAutobuyer, "\n");
                                        }
                                    }

                                    if (itemsLength > 0) {
                                        writeToLog("[✔✔✔] SELL WON ITEMS COUNT: " + itemsLength, idProgressAutobuyer, "\n");
                                        updateStats('lastWonItemsCount', itemsLength);
                                    }

                                    for (var i = 0; i < itemsLength; i++) {
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

                                        const shouldList = sellPrice && !isNaN(sellPrice) && isValidRating;

                                        if (sellPrice < 0) {
                                            services.Item.move(player, ItemPile.TRANSFER);
                                        } else if (shouldList) {
                                            const profit = sellPrice * 0.95 - player._auction.currentBid;
                                            updateProfit(profit);

                                            await sellWonItems(
                                                player,
                                                sellPrice,
                                                buyerSetting["idAbWaitTime"],
                                                buyerSetting["idFutBinDuration"],
                                                profit
                                            );

                                            await wait(getRandWaitTimeInSeconds(buyerSetting['idAbRelistSellItemsWaitTime']))
                                        } else {
                                            services.Item.move(player, ItemPile.CLUB);
                                        }
                                    }
                                }

                                sellMod === SELL_MOD_AFTER_BOT_PAUSE && setValue('needSellWonItemsAfterBotPause', false);
                            }

                            let expiredItems = watchResponse.data.items.filter((item) => {
                                var t = item.getAuctionData();
                                return t.isExpired() || (t.isClosedTrade() && !t.isWon());
                            });

                            const clearExpiredItemsCount = buyerSetting['idClearExpiredItems'];
                            const isNeedClearExpiredByCount = buyerSetting["idAutoClearExpired"] &&
                                clearExpiredItemsCount > 0 &&
                                expiredItems.length >= clearExpiredItemsCount;

                            if ((buyerSetting["idAutoClearExpired"] && expiredItems.length && clearExpiredItemsCount == 0) || isNeedClearExpiredByCount) {
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

                                        return currentBid < userMaxBid;
                                    }
                                ).length

                                let countExpiredItemsWithCurrentBidGreaterThanUserMaxBid = expiredItems.length - countExpiredItemsWithCurrentBidLessThanUserMaxBid;

                                increaseTotalLosedTransferListCount(
                                    countExpiredItemsWithCurrentBidLessThanUserMaxBid,
                                    countExpiredItemsWithCurrentBidGreaterThanUserMaxBid
                                );

                                writeToLog(
                                    "[✘✘✘] CLEAR EXPIRED ITEMS COUNT: " + expiredItems.length + `. LAST BID < ${userMaxBid}, COUNT: ${countExpiredItemsWithCurrentBidLessThanUserMaxBid}. LAST BID >= ${userMaxBid}, COUNT: ${countExpiredItemsWithCurrentBidGreaterThanUserMaxBid}.`,
                                    idProgressAutobuyer,
                                    "\n"
                                );

                                updateStats('lastLessMaxBidItemsCount', countExpiredItemsWithCurrentBidLessThanUserMaxBid)
                                updateStats('lastGreaterMaxBidItemsCount', countExpiredItemsWithCurrentBidGreaterThanUserMaxBid);

                                expiredItems.map(player => {
                                    let auction = player._auction;
                                    let currentBid = (auction.currentBid || auction.startingBid);

                                    writeToLog(
                                        ` (---) Remove Player: ${player._staticData.name}. Last Bid: ${currentBid}. FB: ${getFutBinPlayerPrice(player.definitionId)}.`,
                                        idProgressAutobuyer
                                    );

                                    if (isIssetOutbidLimitPerPlayer) {
                                        outbidLimitPerPlayerMap.delete(auction.tradeId);
                                    }
                                })

                                if (isIssetOutbidLimitPerPlayer && outbidLimitPerPlayerMap.size > 100) {
                                    outbidLimitPerPlayerMap.clear();
                                }
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
        let logMessage = ` (@@@) Try to outbid. Player: ${player._staticData.name}. Bid: ${checkPrice}. FB: ${getFutBinPlayerPrice(player.definitionId)}.`;

        if (buyerSetting['idAbBidLimitPerPlayer'] > 0) {
            logMessage += ` Attempt: ${outbidLimitPerPlayerMap.get(auction.tradeId)}.`;
        }

        writeToLog(logMessage, idProgressAutobuyer);

        increaseOutbidPlayerRequestsCount();

        await buyPlayer(player, playerName, checkPrice, sellPrice);
        // buyerSetting["idAbAddBuyDelay"] && (await wait(1));
    }
};

const getSellWonItemsMod = (buyerSetting) => {
    const cachedMod = getValue('sellWonItemsMod');

    if (cachedMod) {
        return cachedMod;
    }

    const isAutoBuyerActive = getValue("autoBuyerActive");
    const sellPrice = buyerSetting["idAbSellPrice"];
    const sellPriceOrFutBinPrice = ((sellPrice && !isNaN(sellPrice)) || buyerSetting["idSellFutBinPrice"])

    const afterBotPauseMod = isAutoBuyerActive && !buyerSetting["idAbDontMoveWon"] &&
        buyerSetting['idAbSellItemsOnlyAfterBotPause'] && getValue('needSellWonItemsAfterBotPause') === true &&
        sellPriceOrFutBinPrice;

    const sellByCountMod = isAutoBuyerActive && !buyerSetting["idAbDontMoveWon"] &&
        buyerSetting['idAbSellWonItemsCount'] > 0 && !buyerSetting['idAbSellItemsOnlyAfterBotPause'] &&
        sellPriceOrFutBinPrice;

    const autoMod = isAutoBuyerActive && !buyerSetting["idAbDontMoveWon"] && !afterBotPauseMod && !sellByCountMod && sellPriceOrFutBinPrice;

    let sellWonItemsMod;

    switch (true) {
        case autoMod:
            sellWonItemsMod = SELL_MOD_AUTO_DEFAULT;
            break;
        case afterBotPauseMod:
            sellWonItemsMod = SELL_MOD_AFTER_BOT_PAUSE;
            break;
        case sellByCountMod:
            sellWonItemsMod = SELL_MOD_BY_COUNT;
            break;
        default:
            sellWonItemsMod = SELL_MOD_DISABLED;
            break;
    }

    sendUINotification('SELL WON ITEMS MOD: ' + sellWonItemsMod);
    setValue('sellWonItemsMod', sellWonItemsMod);

    return sellWonItemsMod;
}

const sellWonItems = async (
    player,
    sellPrice,
    waitRange,
    sellDuration,
    profit
) => {
    let auction = player._auction;
    sellBids.add(auction.tradeId);
    const boughtPrice = (auction.currentBid || auction.startingBid);

    const logMessage = ` ($$$) Selling Player: ${player._staticData.name}.` + ` Bought: ${boughtPrice}.` + ` Sell: ${sellPrice}.` + ` FB: ${getFutBinPlayerPrice(player.definitionId)}.` + ` Profit: ${profit}.`;

    writeToLog(logMessage, idProgressAutobuyer);

    player.clearAuction();
    increaseSentToTransferListCount();
    increaseEstimatedProfit(profit);
    increaseListPlayerRequestCount();

    await services.Item.list(
        player,
        getSellBidPrice(sellPrice),
        sellPrice,
        convertToSeconds(sellDuration || "1H") || 3600
    );
};

const isOutbidAttemptLimitPerPlayerNotExceeded = (outbidLimit, playerTradeId) => {
    const playerLimitValue = outbidLimitPerPlayerMap.get(playerTradeId);

    if (playerLimitValue === undefined) {
        return true;
    }

    return playerLimitValue != outbidLimit;
}

const increaseOutbidPerPlayerAttemptCount = (playerTradeId) => {
    let playerLimitValue = outbidLimitPerPlayerMap.get(playerTradeId);

    if (playerLimitValue === undefined) {
        outbidLimitPerPlayerMap.set(playerTradeId, 1);
    } else {
        outbidLimitPerPlayerMap.set(playerTradeId, ++playerLimitValue)
    }
}

const controlWatchlistPlayerLimitState = (buyerSetting, watchListItemsCount) => {
    let watchlistPlayerLimit = buyerSetting['idAbWatchlistPlayersLimit'];
    let currentWatchlistLimitActiveState = getValue('WatchlistLimitActive');
    let newWatchlistLimitActiveState = watchListItemsCount >= watchlistPlayerLimit;

    if (currentWatchlistLimitActiveState === newWatchlistLimitActiveState) {
        return;
    }

    setValue('WatchlistLimitActive', newWatchlistLimitActiveState);

    newWatchlistLimitActiveState === true
        ? setWaitTimeObj(...getRangeValue(buyerSetting['idAbWatchlistPlayersLimitWaitTime']))
        : setWaitTimeObj(...getRangeValue(buyerSetting['idAbWaitTime']));

    let logMessage = `WATCHLIST PLAYER LIMIT: ${newWatchlistLimitActiveState ? 'ACTIVATED' : 'DISABLED'}.`;

    writeToLog(logMessage, idProgressAutobuyer, "\n");
}
