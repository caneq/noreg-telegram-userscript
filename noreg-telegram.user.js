// ==UserScript==
// @name         noregtg
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Track publick telegram channels without registration
// @author       caneq
// @match        https://t.me/s/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @downloadURL  https://github.com/caneq/noreg-telegram-userscript/raw/main/noreg-telegram.user.js
// @updateURL    https://github.com/caneq/noreg-telegram-userscript/raw/main/noreg-telegram.user.js
// ==/UserScript==

const BTN_LOAD_MERGE_UPLOAD_SYNC_ID = "BTN_LOAD_MERGE_UPLOAD_SYNC_ID"
const BTN_LOAD_MERGE_UPLOAD_SYNC_INNER_TEXT = "🌎"

function addStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
#tg_buttons_group {
 margin-bottom: 10px;
}

#tg_buttons_group button {
 margin-right: 5px;
 min-width: 3em;
}

#tg_controls_group {
 margin-bottom: 20px;
}

[id$="_channel_group"] {
 display: flex;
 justify-content: left;
 align-items: center;
 white-space: nowrap;
}

.channel_button {
 display: none;
 justify-content: right;
}

[id$="_channel_group"]:hover .channel_button {
 display: unset;
}

[id$="_unreaded_count"] {
 min-width: 1.5em;
 font-weight: bold;
}

.title_group {
 margin-left: 2px;
 display: block;
 max-width: calc(70%);
}

.title_details {
 margin-top: 0px;
 margin-left: 2px;
 margin-bottom: 0px;
 padding: 0px;
 font-size: 12px;
 color: var(--second-color);
}

[id$="_tg_title"] {
 text-overflow: ellipsis;
 display: block;
 overflow: hidden;
 max-width: calc(100%);
}

.tgme_header_right_column_show {
 margin-top: 30px;
}
`
    document.head.appendChild(style);
}

function getTgLastReadedId(channel) {
    return channel + "_last_readed"
}

function getTgDeletedDateId(channel) {
    return channel + "_deleted_date_id"
}

function getTgLastUpdatedId(channel) {
    return channel + "_last_updated"
}

function getControlsGroupId() {
    return "tg_controls_group"
}

function getTgButtonsGroupId() {
    return "tg_buttons_group"
}

function getTgChannelGroupId(channel) {
    return channel + "_channel_group"
}

function getTgTitleId(channel) {
    return channel + "_tg_title"
}

function getTgUnreadedCountId(channel){
    return channel + "_unreaded_count"
}

function getTgPhotoId(channel) {
    return channel + "_photo"
}

function getTgMaxMessageId(channel) {
    return channel + "_max_message_id"
}

function getTgControlLink(channel, readed) {
    return "/s/" + channel + "/" + readed
}

function getSheetDbKey() {
    return GM_getValue("sheetDbKey")
}

function setSheetDbKey(sheetDbKey) {
    GM_setValue("sheetDbKey", sheetDbKey)
}

function getGoogleSheetKey() {
    return GM_getValue("googleSheetKey")
}

function setGoogleSheetKey(googleSheetKey) {
    GM_setValue("googleSheetKey", googleSheetKey)
}

function getTgControlText(channel) {
    let savedName = getTgState(getTgTitleId(channel))
    return savedName || channel
}

function reverse(s){
    return s.split("").reverse().join("");
}

function trimRight(s, trim) {
    if(s.endsWith(trim)) {
        return s.slice(0, s.length - trim.length)
    }
    else{
        return s
    }
}

function encryptKey(channel) {
  return encodeString("tg" + channel)
}

function key2channel(key) {
  return decodeString(key).slice(2)
}

function saveTgState(key, value) {
  localStorage.setItem(encryptKey(key), encodeString(value))
}

function getTgState(key) {
  return decodeString(localStorage.getItem(encryptKey(key)))
}

function updateTgMessageLink(channel, readed){
    let controlElement = document.getElementById(getTgTitleId(channel))
    if (controlElement) {
        controlElement.href = getTgControlLink(channel, readed)
    }
    else {
        addTgControl(channel, readed)
    }

    updateUnreadedCount(channel)
}

function setGmTgValues() {
    let exportData = getExportData()
    if (GM_getValue("data") != exportData){
        GM_setValue("data", exportData)
        console.log("setGmTgValues called, updated")
    }
    else {
        console.log("setGmTgValues called, skipped")
    }
}

function mergeGmTgValues() {
    let exportData = GM_getValue("data")
    let decodedData = decodeString(exportData)
    mergeLastViewedFromDecodedExportData(decodedData)
}

function setLastReadedState(channel, readed) {
    saveTgState(getTgLastReadedId(channel), readed)
    setGmTgValues()
}

function updateTgLastReaded(channel, readed) {
    setLastReadedState(channel, readed)
    updateTgMessageLink(channel, readed)
}

function updateTgLastReadedIfGreater(channel, readed, version) {
    let savedLastReaded = getTgState(getTgLastReadedId(channel)) - 0;
    if(savedLastReaded && savedLastReaded >= readed - 0) {
        return
    }

    let deletedDate = new Date(getTgState(getTgDeletedDateId(channel)));
    if (!savedLastReaded && deletedDate > version) {
        return
    }
    updateTgLastReaded(channel, readed)
}

function deleteTgState(channel) {
    localStorage.removeItem(encryptKey(channel))
    setGmTgValues()
}

function getSavedTgChannelsByKeyPostfixValues(keyPostfix) {
    return Object.entries(localStorage).map(channelState => {
      channelState[0] = key2channel(channelState[0])
      channelState[1] = decodeString(channelState[1])
      return channelState
    })
        .filter(x => x[0].endsWith(keyPostfix))
        .map(x => {
            x[0] = x[0].slice(0, x[0].length - keyPostfix.length)
            return x
    })
  }

function getSavedTgsWithLastReaded() {
    return getSavedTgChannelsByKeyPostfixValues("_last_readed")
}

function getMessagesElements() {
  return [...document.getElementsByClassName("tgme_widget_message_wrap js-widget_message_wrap")]
}

function getMessageTgState(messageElement) {
  return messageElement.querySelectorAll("[data-post]")[0].getAttribute("data-post").split("/")
}

function setOnClick(messageElement) {
  let messageTgState = getMessageTgState(messageElement)
  let viewsElement = messageElement.getElementsByClassName("tgme_widget_message_views")[0]
  if(viewsElement){
      viewsElement.onclick = () => updateTgLastReaded(messageTgState[0], messageTgState[1])
  }
}

function setOnClickForElements(messageElements) {
  messageElements.forEach(messageElement => setOnClick(messageElement))
}

function setOnClickForAll() {
  setOnClickForElements(getMessagesElements())
}

function observeLoadMore() {
    let messagesHistoryElement = document.getElementsByClassName("tgme_channel_history js-message_history")[0]
    let observer = new MutationObserver(mutations => {
        console.log("mutated")
        setOnClickForAll()
    });
    observer.observe(messagesHistoryElement, {subtree:false, childList:true, attributes:false})
}

function getLatestPostId(response) {
    return Math.max(...[...response.matchAll('data-post="[^"]*')].map(x => x[0].split("/")[1] - 0))
}

function getAttributesFromResponse(response, attribute) {
    return [...response.matchAll(attribute + '="[^"]*')].map(x => x[0].slice(attribute.length + '="'.length))
}

function getAttributeFromResponse(response, attribute) {
    return getAttributesFromResponse(response, attribute)[0]
}

function getTgChannelTitle(response) {
    return getAttributeFromResponse(response, 'meta property="og:title" content')
}

function getTgChannelPhoto(response) {
    return getAttributeFromResponse(response, '<img src')
}

function getTgChannelUpdateTime(response) {
    return getAttributesFromResponse(response, 'datetime').reduce((a, b) => new Date(b) > new Date(a) ? b : a)
}

function compareChannels(a, b) {
    let aUpdated = getTgState(getTgLastUpdatedId(a))
    let bUpdated = getTgState(getTgLastUpdatedId(b))
    aUpdated = aUpdated ? aUpdated : 0
    bUpdated = bUpdated ? bUpdated : 0
    return new Date(aUpdated) - new Date(bUpdated)
}

function compareChannelElements(a, b) {
    return compareChannels(trimRight(a.id, "_channel_group"), trimRight(b.id, "_channel_group"))
}

function sortChannels() {
    var list = document.querySelector('#' + getControlsGroupId());
    [...list.children]
        .sort(compareChannelElements)
        .forEach(node=>list.prepend(node));
}

function isToday(date) {
  let today = new Date()
  return date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear()
}

function isYesterday(date){
  let today = new Date()
  return date.getDate() == today.getDate() - 1 && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear()
}

function formatTgTime(date) {
    return date.toLocaleString('default', { hour: "numeric", minute: "numeric" })
}

function formatTgDate(date) {
    if (isToday(date)) {
        return formatTgTime(date)
    }

    if (isYesterday(date)) {
        return 'Yesterday ' + formatTgTime(date)
    }

    return date.toLocaleString('default', { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" })
}

function updateInnerTextIfNeeded(id, innerText) {
    innerText = innerText + ''
    let element = document.getElementById(id)
    if (element.innerText !== innerText) {
        element.innerText = innerText
        return true
    }

    return false
}

function updateControlsValues(channel) {
    updateInnerTextIfNeeded(getTgTitleId(channel), getTgControlText(channel))
    let unreadedCount = getTgState(getTgMaxMessageId(channel)) - getTgState(getTgLastReadedId(channel))
    updateInnerTextIfNeeded(getTgUnreadedCountId(channel), Math.max(unreadedCount, 0))

    let photo = document.getElementById(getTgPhotoId(channel))
    let newPhotoSrc = getTgState(getTgPhotoId(channel))
    if (photo.src !== newPhotoSrc) {
        photo.src = newPhotoSrc
    }

    return updateInnerTextIfNeeded(getTgLastUpdatedId(channel), formatTgDate(new Date(getTgState(getTgLastUpdatedId(channel)))))
}

function updateControls(channel) {
    let sortColumnValueChanged = updateControlsValues(channel)
    if (sortColumnValueChanged) {
        sortChannels()
    }
}

function updateUnreadedCount(channel) {
    let xhr = new XMLHttpRequest()
    xhr.open("GET", "/s/" + channel)
    xhr.send()
    xhr.onload = () => {
        let maxMessage = getLatestPostId(xhr.response)
        let title = getTgChannelTitle(xhr.response)
        let photo = getTgChannelPhoto(xhr.response)
        let lastUpdated = getTgChannelUpdateTime(xhr.response)

        saveTgState(getTgMaxMessageId(channel), maxMessage)
        saveTgState(getTgTitleId(channel), title)
        saveTgState(getTgPhotoId(channel), photo)
        saveTgState(getTgLastUpdatedId(channel), lastUpdated)

        updateControls(channel)
    }
}

function updateUnreadedCountForAll() {
    getSavedTgsWithLastReaded().forEach(x => updateUnreadedCount(x[0]))
}

function deleteTgChannelState(channel) {
    Object.entries(localStorage)
        .map(x => key2channel(x[0]))
        .filter(x => x.startsWith(channel))
        .forEach(x => deleteTgState(x))
}

function deleteTgChannel(channel) {
    let channelGroup = document.getElementById(getTgChannelGroupId(channel))
    channelGroup.remove()
    deleteTgChannelState(channel)
    saveTgState(getTgDeletedDateId(channel), new Date())
}

function addTgControl(channel, readed) {
    let controlsGroup = document.getElementById(getControlsGroupId())

    let channelLineGroupElement = document.createElement("div")
    channelLineGroupElement.id = getTgChannelGroupId(channel)
    controlsGroup.append(channelLineGroupElement)

    let unreadedCountElement = document.createElement("div")
    unreadedCountElement.id = getTgUnreadedCountId(channel)
    channelLineGroupElement.append(unreadedCountElement)

    let photo = document.createElement("img")
    photo.classList.add("tgme_widget_message_user_photo")
    photo.id = getTgPhotoId(channel)
    channelLineGroupElement.append(photo)

    let titleGroup = document.createElement("div")
    titleGroup.classList.add("title_group")
    channelLineGroupElement.append(titleGroup)

    let titleElement = document.createElement("a")
    titleElement.href = getTgControlLink(channel, readed)
    titleElement.id = getTgTitleId(channel)
    titleGroup.append(titleElement)

    let lastUpdatedElement = document.createElement("p")
    lastUpdatedElement.id = getTgLastUpdatedId(channel)
    lastUpdatedElement.classList.add("title_details")
    titleGroup.append(lastUpdatedElement)

    let deleteButton = document.createElement("a")
    deleteButton.classList.add("channel_button")
    deleteButton.innerText = "❌"
    deleteButton.onclick = () => deleteTgChannel(channel)
    channelLineGroupElement.append(deleteButton)

    updateControlsValues(channel)
}

function btoaWithoutEquals(data) {
    return btoa(data).replaceAll("=", "")
}

function atobWithoutEquals(data) {
    let equalsCount = data.length % 4
    if (equalsCount == 3) {
        equalsCount = 1
    }
    return atob(data + "=".repeat(equalsCount))
}

function decodeString(dataString) {
    return dataString ? decodeURIComponent(reverse(atobWithoutEquals(reverse(dataString)))) : dataString
}

function encodeString(dataString) {
    return dataString ? reverse(btoaWithoutEquals(reverse(encodeURIComponent(dataString + '')))) : dataString
}

function getExportData(){
    let dataString = getSavedTgsWithLastReaded().map(x => x[0] + '/' + x[1]).reduce((a, b) => a + '|' + b) + '|' + new Date().toISOString()
    return encodeString(dataString)
}

function mergeLastViewedFromDecodedExportData(decodedExportData) {
    let version = decodedExportData.substring(decodedExportData.lastIndexOf('|') + 1)
    let versionParsed = Date.parse(version) ? new Date(version) : new Date(0)

    cutOffAfterLast(decodedExportData, "|").split("|").forEach(x => {
          let splitted = x.split("/")
          updateTgLastReadedIfGreater(splitted[0], splitted[1], versionParsed)
      })
}

function getOrPrompt(get, set, keyName) {
    if (!get()) {
        let input = prompt(`Your ${keyName}:`)
        if(input) {
            set(input)
        }
    }

    return get()
}

function getOrPromptSheetDbKey() {
    return getOrPrompt(getSheetDbKey, setSheetDbKey, "SheetDb key")
}

function getOrPromptGoogleSheetKey() {
    return getOrPrompt(getGoogleSheetKey, setGoogleSheetKey, "Google sheet key")
}

function loadMergeSyncTgValues(then, onError) {
    let googleSheetKey = getOrPromptGoogleSheetKey();
    if(!googleSheetKey) {
        if(onError){
            onError()
        }
        return
    }

    GM_xmlhttpRequest({
        method: "GET",
        url: `https://docs.google.com/spreadsheets/d/${googleSheetKey}/htmlview`,
        onload: function (result) {
            console.log("loadMergeSyncTgValues")
            if (result.status != 200) {
                console.log(result)
                if(onError){
                    onError()
                }
                return
            }
            let exportData = result.response.match("<div class=\"softmerge-inner.+?>(.+?)<\\/div>")[1]
            console.log(exportData)
            mergeLastViewedFromDecodedExportData(decodeString(exportData))
            if (then) {
                then(exportData)
            }
        }
    });
}

function deleteDeletedDates() {
    getSavedTgChannelsByKeyPostfixValues("_deleted_date_id").forEach(x => {
        deleteTgState(getTgDeletedDateId(x[0]))
    })
}

function loadMergeUploadSyncBtnTextResult(resultText) {
    let btn = document.getElementById(BTN_LOAD_MERGE_UPLOAD_SYNC_ID)
    btn.innerText = resultText
    setTimeout(() => {
        btn.innerText = BTN_LOAD_MERGE_UPLOAD_SYNC_INNER_TEXT
        btn.removeAttribute("disabled")
    }, 1000)
}

function loadMergeUploadSyncBtnTextSuccess() {
    loadMergeUploadSyncBtnTextResult("✅")
}

function loadMergeUploadSyncBtnTextFail() {
    loadMergeUploadSyncBtnTextResult("❌")
}

function cutOffAfterLast(str, separator) {
    return str.slice(0, str.lastIndexOf(separator))
}

function channelStatesEquals(exportData1, exportData2){
    return cutOffAfterLast(decodeString(exportData1), '|') === cutOffAfterLast(decodeString(exportData2), '|')
}

function loadMergeUploadSyncTgValues() {
    let btn = document.getElementById(BTN_LOAD_MERGE_UPLOAD_SYNC_ID)
    btn.setAttribute("disabled", true)
    btn.innerText = "⌛"

    loadMergeSyncTgValues(loadedExportData => {
        if (channelStatesEquals(loadedExportData, getExportData())) {
            console.log("already synced")
            loadMergeUploadSyncBtnTextSuccess()
            return
        }

        if(!getOrPromptSheetDbKey()) {
            loadMergeUploadSyncBtnTextFail()
            return
        }

        let exportData = getExportData()
        console.log(JSON.stringify({value: exportData}))
        GM_xmlhttpRequest({
            method: "PATCH",
            url: "https://sheetdb.io/api/v1/" + getSheetDbKey() + "/id/1",
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({value: exportData}),
            onload: function (result) {
                console.log("loadMergeUploadSyncTgValues")
                console.log(result)
                if (result.status != 200){
                    loadMergeUploadSyncBtnTextFail()
                    return
                }

                loadMergeUploadSyncBtnTextSuccess()
                deleteDeletedDates()
            }
        });
    },
    () => {
        loadMergeUploadSyncBtnTextFail()
    })
}

function addButtonControl(buttonsGroup, innerText, onclick, id) {
    let buttonElement = document.createElement("button")
    if (id) {
        buttonElement.id = id
    }
    buttonElement.innerText = innerText
    buttonElement.onclick = onclick
    buttonsGroup.appendChild(buttonElement)
}

function addButtonsControls() {
    let footerElement = document.getElementsByClassName("tgme_channel_info")[0]

    let buttonsGroup = document.createElement("div")
    buttonsGroup.id = getTgButtonsGroupId()
    footerElement.prepend(buttonsGroup)

    addButtonControl(buttonsGroup, "🔄", updateUnreadedCountForAll)
    addButtonControl(buttonsGroup, BTN_LOAD_MERGE_UPLOAD_SYNC_INNER_TEXT, loadMergeUploadSyncTgValues, BTN_LOAD_MERGE_UPLOAD_SYNC_ID)
    addButtonControl(buttonsGroup, "⬇️📋", async () => {
      let dataEncoded = await navigator.clipboard.readText();
      let data = decodeString(dataEncoded)
      mergeLastViewedFromDecodedExportData(data)
    })
    addButtonControl(buttonsGroup, "⬆️📋", async () => await navigator.clipboard.writeText(getExportData()))
}

function addTgControls() {
  let footerElement = document.getElementsByClassName("tgme_channel_info")[0]

  let controlsGroup = document.createElement("div")
  controlsGroup.id = getControlsGroupId()
  footerElement.prepend(controlsGroup)

  let savedTgs = getSavedTgsWithLastReaded()
  savedTgs.sort((a, b) => compareChannels(b[0], a[0]))
  savedTgs.forEach(tg => {
      addTgControl(tg[0], tg[1])
  })
  addButtonsControls()
}

function toggleSidebarClass() {
    console.log("tgme_header_right_column onclick")
    if (document.querySelector(".tgme_header_right_column")) {
        document.querySelector(".tgme_header_right_column").classList.replace("tgme_header_right_column", "tgme_header_right_column_show")
    }
    else {
        document.querySelector(".tgme_header_right_column_show")?.classList.replace("tgme_header_right_column_show", "tgme_header_right_column")
    }
}

function onclickToggleSidebar() {
    document.querySelector(".tgme_channel_join_telegram").removeAttribute("href")
    document.querySelector(".tgme_header_link").removeAttribute("href")
    document.querySelector(".tgme_channel_download_telegram").removeAttribute("href")
    document.querySelector(".tgme_channel_download_telegram").onclick = toggleSidebarClass
    document.querySelector(".tgme_channel_join_telegram").onclick = toggleSidebarClass
}

(function() {
    'use strict';
    addStyles()
    setOnClickForAll()
    addTgControls()
    observeLoadMore()
    mergeGmTgValues()
    loadMergeSyncTgValues()
    onclickToggleSidebar()
    updateUnreadedCountForAll()
})();
