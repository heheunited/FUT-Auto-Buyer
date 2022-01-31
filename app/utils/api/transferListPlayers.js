import {postRequestToBackend} from "./apiRequest";
import {sendUINotification} from "../notificationUtil";
import {getFutBinPlayerPrice} from "../priceUtils";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';

const saveStatisticAboutTransferListPlayers = (playersList) => {
    let dataForBackend = {
        data: playersList.map(player => {
            let auction = player._auction;

            return {
                name: player._staticData.name,
                futbin_price: getFutBinPlayerPrice(player.definitionId, 100, 0),
                current_bid: (auction.currentBid || auction.startingBid),
                buy_now_price: auction.buyNowPrice,
                minimal_bid: auction.startingBid,
                position: player.preferredPosition,
                rating: parseInt(player.rating),
                trade_id: auction.tradeId,
                trade_state: auction._tradeState
            }
        })
    }

    let endpoint = apiEndpoint + '/autobuyer/statistic/players';

    postRequestToBackend(endpoint, dataForBackend)
        .then(response => {
            let responseData = response.data;

            if (responseData.success === true) {
                sendUINotification(`Transfer list players statistic recorded!`);
            }
        }).catch(error => {
        sendUINotification(`Something went wrong. Error: ${error}`, UINotificationType.NEGATIVE);
    })
}

export {saveStatisticAboutTransferListPlayers}