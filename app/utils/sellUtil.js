import {convertToSeconds, getRandNumberInRange} from "./commonUtil";
import {getBuyBidPrice, getFutBinPlayerPrice, getSellBidPrice, roundOffPrice} from "./priceUtils";
import {writeToLog} from "./logUtil";
import {idProgressAutobuyer} from "../elementIds.constants";
import {getBuyerSettings, getValue, setValue} from "../services/repository";
import {increaseReListPlayerRequestCount} from "./transferListStatsUtils";

export const listForPrice = async (sellPrice, player, futBinPercent) => {
    let buyerSetting = getBuyerSettings();
    await getPriceLimits(player);
    if (sellPrice > 0) {
        futBinPercent = getRandNumberInRange(futBinPercent) || 100;
        const duration = buyerSetting['idFutBinDuration'];
        let calculatedPrice = (sellPrice * futBinPercent) / 100;
        if (player.hasPriceLimits()) {
            calculatedPrice = roundOffPrice(
                Math.min(
                    player._itemPriceLimits.maximum,
                    Math.max(player._itemPriceLimits.minimum, calculatedPrice)
                )
            );

            if (calculatedPrice === player._itemPriceLimits.minimum) {
                calculatedPrice = getBuyBidPrice(calculatedPrice);
            }
        }

        calculatedPrice = roundOffPrice(calculatedPrice, 200);

        if (Number(player._auction.buyNowPrice) === calculatedPrice) {

            if (getValue('shouldRelistAfterFbPrice') === false) {
                setValue('shouldRelistAfterFbPrice', true);
                writeToLog(
                    `[^^^] Relist after FutBin price activated.`,
                    idProgressAutobuyer
                )
            }

            return false;
        }

        writeToLog(
            `[###] Relist /w FutBin. Player: ${player._staticData.name}. Price: ${calculatedPrice}. FB price: ${getFutBinPlayerPrice(player.definitionId)}$`,
            idProgressAutobuyer
        )

        increaseReListPlayerRequestCount();

        services.Item.list(
            player,
            getSellBidPrice(calculatedPrice),
            calculatedPrice,
            convertToSeconds(duration) || 3600
        );

        return true;
    }

    return false;
};

const getPriceLimits = async (player) => {
    return new Promise((resolve) => {
        if (player.hasPriceLimits()) {
            resolve();
            return;
        }
        services.Item.requestMarketData(player).observe(
            this,
            async function (sender, response) {
                resolve();
            }
        );
    });
};
