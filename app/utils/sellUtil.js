import {convertToSeconds, getRandNumberInRange} from "./commonUtil";
import {getBuyBidPrice, getFutBinPlayerPrice, getSellBidPrice, roundOffPrice} from "./priceUtils";
import {getBuyerSettings} from "../services/repository";
import {increaseReListPlayerRequestCount} from "./transferListStatsUtils";
import {idProgressAutobuyer} from "../elementIds.constants";
import {writeToLog} from "./logUtil";

export const listForPrice = async (sellPrice, player, futBinPercent) => {
    let buyerSetting = getBuyerSettings();
    await getPriceLimits(player);
    if (sellPrice) {
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

        increaseReListPlayerRequestCount();

        writeToLog(
            ` (###) Relist /w FutBin. Player: ${player._staticData.name}. Price: ${calculatedPrice}. FB: ${getFutBinPlayerPrice(player.definitionId)}.`,
            idProgressAutobuyer
        )

        services.Item.list(
            player,
            getSellBidPrice(calculatedPrice),
            calculatedPrice,
            convertToSeconds(duration) || 3600
        );
    }
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
