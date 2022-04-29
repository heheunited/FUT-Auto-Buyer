import {STATE_ACTIVE, STATE_PAUSED, STATE_STOPPED} from "../app.constants";
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
    pauseBotIfRequired, stopBotIfRequired,
} from "../utils/autoActionsUtil";
import {
    convertRangeToSeconds,
    convertToSeconds,
    formatString,
    getRandNum,
    getRangeValue,
    playAudio, setWaitTimeObj,
} from "../utils/commonUtil";
import {addFutbinCachePrice, setFutBinPricesCacheTime} from "../utils/futbinUtil";
import {writeToDebugLog, writeToLog} from "../utils/logUtil";
import {
    sendErrorNotificationToUser,
    sendPinEvents,
    sendUINotification
} from "../utils/notificationUtil";
import {
    getBuyBidPrice, getFutBinPlayerPrice,
    getSellBidPrice,
    roundOffPrice,
} from "../utils/priceUtils";
import {buyPlayer, checkRating, isBidOrBuyMakeExpectedPercentProfit} from "../utils/purchaseUtil";
import {updateRequestCount} from "../utils/statsUtil";
import {setRandomInterval} from "../utils/timeOutUtil";
import {transferListUtil} from "../utils/transferlistUtil";
import {addUserWatchItems, watchListUtil} from "../utils/watchlistUtil";
import {searchErrorHandler} from "./errorHandler";
import {
    getRequestsStatisticForBackend,
    getSummaryTransferListStats,
    getTradeItemsStatisticForBackend,
    increaseSearchRequestCount
} from "../utils/transferListStatsUtils";
import {recordItemTradeStatistics} from "../utils/api/autobuyerItemsTradeStatistic";
import {recordRequestsStatistics} from "../utils/api/autobuyerRequestsStatistic";
import {_deleteAllCaptchaEntities} from "../utils/captchaUtil";
import {
    MARKETS_OVERFLOWED, TRANSFER_LIST_OVERFLOWED,
    WAIT_STATUS_REQUEST_COUNTER,
    WAIT_UNTIL_WATCH_LIST_WILL_BE_EMPTY,
    WAIT_UNTIL_WORK_STATUS, WATCH_LIST_LIMIT_ACTIVE, WATCH_LIST_OVERFLOWED
} from "../utils/constants";

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

    let buyerSetting = getBuyerSettings();
    const isActive = getValue("autoBuyerActive");

    if (isActive) {
        return;
    }

    sendUINotification(isResume ? "Autobuyer Resumed" : "Autobuyer Started");
    setValue("autoBuyerActive", true);
    setValue("autoBuyerState", STATE_ACTIVE);
    setWaitTimeObj(...getRangeValue(buyerSetting['idAbWaitTime']));
    setValue(WATCH_LIST_LIMIT_ACTIVE, false);
    setValue(WAIT_UNTIL_WATCH_LIST_WILL_BE_EMPTY, WAIT_UNTIL_WORK_STATUS);
    setValue(MARKETS_OVERFLOWED, false);
    setValue(WAIT_STATUS_REQUEST_COUNTER, 0);

    if (!isResume) {
        setValue("botStartTime", new Date());
        setValue("purchasedCardCount", 0);
        setValue("searchFailedCount", 0);
        setValue("currentPage", 1);
        _deleteAllCaptchaEntities()
    }

    let srchTmWithContext = searchTransferMarket.bind(this);
    let watchListWithContext = watchListUtil.bind(this);
    let transferListWithContext = transferListUtil.bind(this);
    let pauseBotWithContext = pauseBotIfRequired.bind(this);
    let isIssetWatchlistPlayerLimit = buyerSetting['idAbWatchlistPlayersLimit'] > 0;

    await setFutBinPricesCacheTime(buyerSetting);
    setValue('needSellWonItemsAfterBotPause', buyerSetting['idAbSellItemsOnlyAfterBotPause']);
    !isResume && (await addUserWatchItems());

    sendPinEvents("Hub - Transfers");
    await transferListWithContext(
        buyerSetting["idAbSellToggle"],
        buyerSetting["idAbMinDeleteCount"],
        buyerSetting["idAbRelistUnsoldWithUpdatePrice"]
    );

    sendPinEvents("Hub - Transfers");
    await watchListWithContext(buyerSetting);

    sendPinEvents("Hub - Transfers");
    await srchTmWithContext(buyerSetting);

    let operationInProgress = false;
    if (getValue("autoBuyerActive")) {
        interval = setRandomInterval(async () => {
            passInterval = await pauseBotWithContext(buyerSetting);
            stopBotIfRequired(buyerSetting);
            const isBuyerActive = getValue("autoBuyerActive");
            const watchlistLimitActiveState = getValue(WATCH_LIST_LIMIT_ACTIVE);

            if (isBuyerActive && !operationInProgress) {
                operationInProgress = true;
                buyerSetting = getBuyerSettings();

                if (getValue(MARKETS_OVERFLOWED) === false) {
                    if (isIssetWatchlistPlayerLimit || buyerSetting['idAbWaitUntilWatchlistWillBeEmpty']) {
                        if (watchlistLimitActiveState === false && getValue(WAIT_UNTIL_WATCH_LIST_WILL_BE_EMPTY) === WAIT_UNTIL_WORK_STATUS) {
                            sendPinEvents("Hub - Transfers");
                            await srchTmWithContext(buyerSetting);
                        }
                    } else {
                        sendPinEvents("Hub - Transfers");
                        await srchTmWithContext(buyerSetting);
                    }

                    sendPinEvents("Hub - Transfers");
                    await watchListWithContext(buyerSetting);

                    if (watchlistLimitActiveState === false && getValue(WAIT_UNTIL_WATCH_LIST_WILL_BE_EMPTY) === WAIT_UNTIL_WORK_STATUS) {
                        sendPinEvents("Hub - Transfers");
                        await transferListWithContext(buyerSetting["idAbSellToggle"], buyerSetting["idAbMinDeleteCount"]);
                    }
                } else {
                    sendPinEvents("Hub - Transfers");
                    await transferListWithContext(buyerSetting["idAbSellToggle"], buyerSetting["idAbMinDeleteCount"]);
                }

                controlMarketsOverflowedState(buyerSetting);

                operationInProgress = false;
            }
        });
    }
};

export const autoRestartAutoBuyer = () => {
    let buyerSetting = getBuyerSettings();
    setValue('needSellWonItemsAfterBotPause', buyerSetting['idAbSellItemsOnlyAfterBotPause']);
    if (buyerSetting["idAbRestartAfter"]) {
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

    if (!isPaused) {
        let tradeItemsStatisticDataForBackend = getTradeItemsStatisticForBackend();
        let requestsStatisticDataForBackend = getRequestsStatisticForBackend(true);

        if (tradeItemsStatisticDataForBackend !== false) {
            recordItemTradeStatistics(tradeItemsStatisticDataForBackend);
        }

        if (requestsStatisticDataForBackend !== false) {
            recordRequestsStatistics(requestsStatisticDataForBackend);
        }

        let summaryStatsMsg = getSummaryTransferListStats(true);
        sendErrorNotificationToUser('Autobuyer go IDLE. ' + summaryStatsMsg);
        writeToLog(summaryStatsMsg, idProgressAutobuyer);
    }
};

const controlMarketsOverflowedState = (buyerSetting) => {
    if (buyerSetting['idAbOverflowingPassiveMod'] && getValue(TRANSFER_LIST_OVERFLOWED) === true && getValue(WATCH_LIST_OVERFLOWED) === true) {
        writeToLog('OVERFLOWING PASSIVE MOD ACTIVATED.', idProgressAutobuyer, "\n")
        setValue(MARKETS_OVERFLOWED, true);
        setWaitTimeObj(20, 40);
    } else {
        if (getValue(MARKETS_OVERFLOWED) !== false) {
            setWaitTimeObj(buyerSetting['idAbWaitTime']);
            setValue(MARKETS_OVERFLOWED, false);
        }
    }
}

const searchTransferMarket = function (buyerSetting) {
    return new Promise((resolve) => {
        const expiresIn = convertToSeconds(buyerSetting["idAbItemExpiring"]);
        const useRandMinBid = buyerSetting["idAbRandMinBidToggle"];
        const useRandMinBuy = buyerSetting["idAbRandMinBuyToggle"];
        const futBinBuyPercent = buyerSetting["idBuyFutBinPercent"] || 100;
        let currentPage = getValue("currentPage") || 1;
        const playersList = new Set(
            (buyerSetting["idAddIgnorePlayersList"] || []).map(({id}) => id)
        );

        let bidPrice = buyerSetting["idAbMaxBid"];
        let userBuyNowPrice = buyerSetting["idAbBuyPrice"];
        let useFutBinPrice = buyerSetting["idBuyFutBinPrice"];

        let userFutBinMinimalPrice = buyerSetting["idAbBuyFutMinimalPrice"];
        let isUserFutBinMinimalPriceProvided = userFutBinMinimalPrice > 0;

        let userFutBinMaximalPrice = buyerSetting["idAbBuyFutMaximalPrice"];
        let isUserFutBinMaximalPriceProvided = userFutBinMaximalPrice > 0;

        let expectedProfitInPercent = buyerSetting['idAbExpectedProfitInPercent'];
        let isExpectedProfitInPercentProvided = expectedProfitInPercent > 0;

        let expectedProfitInPercentForBuy = buyerSetting['idAbExpectedProfitInPercentForBuy'];
        let isExpectedProfitInPercentForBuyProvided = expectedProfitInPercentForBuy > 0;

        let isSearchByExpectedProfit = (!userBuyNowPrice && !bidPrice && !useFutBinPrice) && (isExpectedProfitInPercentProvided || isExpectedProfitInPercentForBuyProvided);

        if (!userBuyNowPrice && !bidPrice && !useFutBinPrice && !isSearchByExpectedProfit) {
            writeToLog(
                "skip search >>> (No Buy or Bid Price given)",
                idAutoBuyerFoundLog
            );

            return resolve();
        }

        sendPinEvents("Transfer Market Search");
        updateRequestCount();
        increaseSearchRequestCount();
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
                            "| rating   | player name     | bid    | buy    | FutBin     | time            | action",
                            idAutoBuyerFoundLog
                        );

                        currentPage === 1 && sendPinEvents("Transfer Market Results - List View");

                        if (buyerSetting['idAbIsPlayerTypeSearch']) {
                            await addFutbinCachePrice(response.data.items);
                        }
                    } else {
                        return resolve();
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

                    if (buyerSetting["idAbShouldSort"]) {
                        response.data.items = sortPlayers(
                            response.data.items,
                            buyerSetting["idAbSortBy"] || "buy",
                            buyerSetting["idAbSortOrder"]
                        );
                    }

                    for (let i = response.data.items.length - 1; i >= 0 && getValue("autoBuyerActive"); i--) {
                        let player = response.data.items[i];
                        let auction = player._auction;
                        let type = player.type;
                        let {id} = player._metaData || {};
                        let playerRating = parseInt(player.rating);
                        let expires = services.Localization.localizeAuctionTimeRemaining(auction.expires);
                        let fbPriceWithCommission = getFutBinPlayerPrice(player.definitionId, 95);

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
                                writeToLog(`Error fetch fetching Price for ${player._staticData.name}`, idProgressAutobuyer);
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

                        let byBuyNowPrice = false;
                        let byCurrentBidPrice = false;
                        if (isSearchByExpectedProfit) {
                            let fbPrice = fbPriceWithCommission;

                            if (isExpectedProfitInPercentProvided) {
                                byCurrentBidPrice = isBidOrBuyMakeExpectedPercentProfit(null, checkPrice, fbPrice, expectedProfitInPercent);
                            }

                            if (isExpectedProfitInPercentForBuyProvided) {
                                byBuyNowPrice = isBidOrBuyMakeExpectedPercentProfit(buyNowPrice, null, fbPrice, expectedProfitInPercentForBuy);
                            }
                        }

                        const isMinimalPLayerFutBinPriceCorrect = isUserFutBinMinimalPriceProvided
                            ? getFutBinPlayerPrice(player.definitionId) >= userFutBinMinimalPrice
                            : false;

                        const isMaximalPLayerFutBinPriceExceeded = isUserFutBinMaximalPriceProvided
                            ? currentPlayerFutBinPrice > userFutBinMaximalPrice
                            : false;

                        let usersellPrice = buyerSetting["idAbSellPrice"];
                        let minRating = buyerSetting["idAbMinRating"];
                        let maxRating = buyerSetting["idAbMaxRating"];

                        let bidTxt = formatString(currentBid.toString(), 6);
                        let buyTxt = formatString(buyNowPrice.toString(), 6);
                        let fuutbinPriceTxt = formatString(currentPlayerFutBinPrice ? currentPlayerFutBinPrice.toString() : 'null', 10)
                        let playerName = formatString(player._staticData.name, 15);
                        let expireTime = formatString(expires, 15);

                        const shouldCheckRating = minRating || maxRating;

                        const isValidRating = !shouldCheckRating || checkRating(playerRating, minRating, maxRating);
                        const ratingTxt = !isValidRating ? "no" : "ok";

                        const logWrite = writeToLogClosure(
                            "(" + playerRating + "-" + ratingTxt + ") ",
                            playerName,
                            bidTxt,
                            buyTxt,
                            fuutbinPriceTxt,
                            expireTime
                        );

                        if (isSearchByExpectedProfit && !byBuyNowPrice && !byCurrentBidPrice) {
                            logWrite(`skip >>> (Search by %. No profit ${expectedProfitInPercent}% || ${expectedProfitInPercentForBuy}%)`);
                            continue;
                        }

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
                            logWrite("skip >>> (min futbin price > futbin price)");
                            continue;
                        }

                        if (isUserFutBinMaximalPriceProvided && isMaximalPLayerFutBinPriceExceeded) {
                            logWrite("skip >>> (futbin price > max futbin price)");
                            continue;
                        }

                        if (
                            !userBuyNowPrice && bidPrice && isExpectedProfitInPercentProvided &&
                            !isBidOrBuyMakeExpectedPercentProfit(null, checkPrice, fbPriceWithCommission, expectedProfitInPercent)
                        ) {
                            logWrite(`skip >>> (Bid dont make expected profit: ${expectedProfitInPercent}%)`);
                            continue;
                        }

                        if (
                            !bidPrice && userBuyNowPrice && isExpectedProfitInPercentForBuyProvided &&
                            !isBidOrBuyMakeExpectedPercentProfit(buyNowPrice, null, fbPriceWithCommission, expectedProfitInPercentForBuy)
                        ) {
                            logWrite(`skip >>> (Buy dont make expected profit: ${expectedProfitInPercentForBuy}%)`);
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

                        if ((buyNowPrice <= userBuyNowPrice) || (isSearchByExpectedProfit && byBuyNowPrice)) {
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

                        if ((bidPrice && currentBid <= priceToBid) || (isSearchByExpectedProfit && byCurrentBidPrice)) {
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
    futbinPriceTxt,
    expireTime
) => {
    return (actionTxt) => {
        writeToDebugLog(
            ratingTxt,
            playerName,
            bidTxt,
            buyTxt,
            futbinPriceTxt,
            expireTime,
            actionTxt
        );
    };
};
