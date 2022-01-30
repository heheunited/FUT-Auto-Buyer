import {postRequestToBackend} from "./apiRequest";
import {sendUINotification} from "../notificationUtil";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';
const tradeItemsStatisticPath = '/autobuyer/statistic/trade-items';
const tradeItemsStatisticPathEndpoint = apiEndpoint + tradeItemsStatisticPath;

const recordItemTradeStatistics = (data) => {
    postRequestToBackend(tradeItemsStatisticPathEndpoint, data)
        .then(response => {
            const responseData = response.data;

            if (responseData.success === true) {
                sendUINotification(`Statistic recorded!`);
            }
        }).catch(console.log)
}

export {recordItemTradeStatistics}