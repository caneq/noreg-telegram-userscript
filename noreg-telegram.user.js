// ==UserScript==
// @name         noregtg
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Track publick telegram channels without registration
// @author       caneq
// @match        https://t.me/s/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @downloadURL  https://github.com/caneq/noreg-telegram-userscript/raw/main/noreg-telegram.user.js
// @updateURL    https://github.com/caneq/noreg-telegram-userscript/raw/main/noreg-telegram.user.js
// ==/UserScript==

function addStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
#tg_buttons_group {
 margin-bottom: 10px;
}

#tg_buttons_group button {
 margin-right: 5px;
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
  return reverse("tg" + channel)
}

function key2channel(key) {
  return reverse(key).slice(2)
}

function saveTgState(key, value) {
  localStorage.setItem(encryptKey(key), value)
}

function getTgState(key) {
  return localStorage.getItem(encryptKey(key))
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
    }
}

function getGmTgValues() {
    let exportData = GM_getValue("data")
    let decodedData = decodeExportData(exportData)
    updateLastViewedFromDecodedExportData(decodedData)
}

function updateTgLastReaded(channel, readed) {
    saveTgState(getTgLastReadedId(channel), readed)
    updateTgMessageLink(channel, readed)
    setGmTgValues()
}

function deleteTgState(channel) {
    localStorage.removeItem(encryptKey(channel))
}

function getSavedTgsWithLastReaded() {
  return Object.entries(localStorage).map(channelState => {
    channelState[0] = key2channel(channelState[0])
    return channelState
  })
      .filter(x => x[0].endsWith("_last_readed"))
      .map(x => {
          x[0] = x[0].slice(0, x[0].length - "_last_readed".length)
          return x
  })
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

function padNumber(number, maxDigits) {
    return "0".repeat(Math.max(maxDigits - (number + '').length, 0)) + number
}

function formatTgTime(date) {
    return padNumber(date.getHours(), 2) + ':' + padNumber(date.getMinutes(), 2)
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

function updateControlsValues(channel) {
    let titleElement = document.getElementById(getTgTitleId(channel))
    titleElement.innerText = getTgControlText(channel)

    let unreadedCountElement = document.getElementById(getTgUnreadedCountId(channel))
    let unreadedCount = getTgState(getTgMaxMessageId(channel)) - getTgState(getTgLastReadedId(channel))
    unreadedCountElement.innerText = Math.max(unreadedCount, 0)

    let photo = document.getElementById(getTgPhotoId(channel))
    photo.src = getTgState(getTgPhotoId(channel))

    let lastUpdated = document.getElementById(getTgLastUpdatedId(channel))
    lastUpdated.innerText = formatTgDate(new Date(getTgState(getTgLastUpdatedId(channel))))
}

function updateControls(channel) {
    updateControlsValues(channel)
    sortChannels()
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

function getExportData(){
    return reverse(btoaWithoutEquals(reverse(getSavedTgsWithLastReaded().map(x => x[0] + '/' + x[1]).reduce((a, b) => a + '|' + b))))
}

function decodeExportData(exportData) {
    return reverse(atob(reverse(exportData)))
}

function updateLastViewedFromDecodedExportData(decodedExportData){
    decodedExportData.split("|").forEach(x => {
          let splitted = x.split("/")
          updateTgLastReaded(splitted[0], splitted[1])
      })
}

function getOrPromptSheetDbKey() {
    if (!getSheetDbKey()) {
        let sheetDbKey = prompt("Your SheetDbKey used to store state:")
        if(sheetDbKey) {
            setSheetDbKey(sheetDbKey)
        }
    }

    return getSheetDbKey()
}

function getSyncTgValues() {
    if(!getOrPromptSheetDbKey()) {
        return
    }

    GM_xmlhttpRequest({
        method: "GET",
        url: "https://sheetdb.io/api/v1/" + getSheetDbKey(),
        onload: function (result) {
            console.log("getSyncTgValues")
            console.log(result)
            updateLastViewedFromDecodedExportData(decodeExportData(JSON.parse(result.response)[0].value))
        }
    });
}

function setSyncTgValues() {
    if(!getOrPromptSheetDbKey()) {
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
            console.log("setSyncTgValues")
            console.log(result)
        }
    });
}

function addButtonControl(buttonsGroup, innerText, onclick) {
    let ButtonElement = document.createElement("button")
    ButtonElement.innerText = innerText
    ButtonElement.onclick = onclick
    buttonsGroup.appendChild(ButtonElement)
}

function addButtonsControls() {
    let footerElement = document.getElementsByClassName("tgme_channel_info")[0]

    let buttonsGroup = document.createElement("div")
    buttonsGroup.id = getTgButtonsGroupId()
    footerElement.prepend(buttonsGroup)

    addButtonControl(buttonsGroup, "🔄", updateUnreadedCountForAll)
    addButtonControl(buttonsGroup, "⬇️🌎", getSyncTgValues)
    addButtonControl(buttonsGroup, "⬆️🌎", setSyncTgValues)
    addButtonControl(buttonsGroup, "⬇️📋", async () => {
      let dataEncoded = await navigator.clipboard.readText();
      let data = decodeExportData(dataEncoded)
      updateLastViewedFromDecodedExportData(data)
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
    getGmTgValues()
    onclickToggleSidebar()
})();
