import {
  idAutoBuyerFoundLog,
  idProgressAutobuyer,
} from "../../elementIds.constants";

export const logView = () => {
  return `<div ${!isPhone() ? "style=width:52%" : ""}>
            <textarea readonly id=${idProgressAutobuyer} class="autoBuyerLog"></textarea>
            <label>Search Results:</label>
            <br/>
            <textarea readonly id=${idAutoBuyerFoundLog} class="autoBuyerLog searchLog"></textarea>
        </div>`;
};

export const initializeLog = () => {
  const log = $("#" + idProgressAutobuyer);
  let time_txt = "[" + new Date().toLocaleTimeString() + "] ";
  let log_init_text =
    "Autobuyer Ready\n" +
    time_txt +
    " Index  | Item name       | Price  | FutBin   | OP  | Result  | Comments          | Exp\n";
  log.val(log_init_text);
};
