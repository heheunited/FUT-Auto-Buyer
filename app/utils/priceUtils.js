import {getValue} from '../services/repository';

export const roundOffPrice = (price) => {
  let range = JSUtils.find(UTCurrencyInputControl.PRICE_TIERS, function(e) {
    return price >= e.min;
  });
  var nearestPrice = Math.round(price / range.inc) * range.inc;
  return Math.max(Math.min(nearestPrice, 14999000), 0);
};

export const getSellBidPrice = (bin) => {
  if (bin <= 1000) {
    return bin - 50;
  }

  if (bin > 1000 && bin <= 10000) {
    return bin - 100;
  }

  if (bin > 10000 && bin <= 50000) {
    return bin - 250;
  }

  if (bin > 50000 && bin <= 100000) {
    return bin - 500;
  }

  return bin - 1000;
};

export const getBuyBidPrice = (bin) => {
  if (bin < 1000) {
    return bin + 50;
  }

  if (bin >= 1000 && bin < 10000) {
    return bin + 100;
  }

  if (bin >= 10000 && bin < 50000) {
    return bin + 250;
  }

  if (bin >= 50000 && bin < 100000) {
    return bin + 500;
  }

  return bin + 1000;
};

export const calculateProfitPercent = (playerPrice, userPrice) => {
  if (!playerPrice || !userPrice) {
    return 0;
  }

  let resultPercent = (userPrice / playerPrice) * 100;

  return Math.round(100 - resultPercent);
};

export const getEstimatedProfitPercentString = (
    definitionId, currentPrice, customPrice = null) => {
  const price = customPrice || getFutBinPlayerPrice(definitionId, 95);

  if (price === null) {
    return 'null';
  }

  const estimatedProfit = calculateProfitPercent(price, currentPrice);

  if (estimatedProfit === 0) {
    return 'null';
  }

  return estimatedProfit + '%';
};

export const getFutBinPlayerPrice = (
    definitionId, idBuyFutBinPercent = 100, defaultValue = null) => {
  const existingValue = getValue(definitionId);

  if (existingValue && existingValue.price) {
    return roundOffPrice(
        (existingValue.price * idBuyFutBinPercent) / 100,
    );
  }

  return defaultValue;
};

export const getPriceWithSellPercent = (playerPrice, percent) => {
  return Math.round((percent / 100) * playerPrice);
};
