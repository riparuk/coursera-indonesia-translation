async function openBilingual () {
  // Enable bilingual subtitles
  let tracks = document.getElementsByTagName('track')
  let en
  let id
  if (tracks.length) {
    // 1. Traverse the subtitle nodes to find Chinese and English subtitles
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].srclang === 'en') {
        en = tracks[i]
      } else if (tracks[i].srclang === 'id') {
        id = tracks[i]
      }
    }
    // 2. If English subtitles exist, turn on
    
    if (en) {
      en.track.mode = 'showing'
       //3. Determine whether Chinese subtitles exist, if so, open them directly
      if (id) {
        id.track.mode = 'showing'
      } else {
        // 4. If it doesn't exist, enable translation
         // Chrome updated to 74 or later
         // There seems to be a delay between first setting track.mode = 'showing' and when the cues are loaded?
         // temporarily use sleep to give the cues plenty of time to load the subtitles to make sure they work properly, and come to this later
        await sleep(500)
        let cues = en.track.cues
        // Since sentence-by-sentence translation will require a large number of translation APIs, the number of requests needs to be reduced
        const cuesTextList = getCuesTextList(cues)
        // translate
        for (let i = 0; i < cuesTextList.length; i++) {
          getTranslation(cuesTextList[i][1], translatedText => {
            // Get the returned text, split based on the previously inserted newline
             // Then determine the sequence of cues text, which is the previously stored starting position + the current relative position
             // Add the translated text directly after the English subtitle
            const translatedTextList = translatedText.split('\n\n')
            for (let j = 0; j < translatedTextList.length; j++) {
              cues[cuesTextList[i][0] + j].text += '\n' + translatedTextList[j]
            }
          })
        }
      }
    }
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getCuesTextList (cues) {
  // Take out all the text content of the subtitles and integrate them into a list
   // Each item is a string of no more than 5000 words, (it seems that the API currently used has a limit of 5000 words?)
   // and its starting position in cues
   // The returned data structure is probably [[0, text], [95, text]]
  let cuesTextList = []
  for (let i = 0; i < cues.length; i++) {
    if (cuesTextList.length &&
        cuesTextList[cuesTextList.length - 1][1].length +
        cues[i].text.length < 5000) {
      // A delimiter (newline) needs to be inserted so that the translated string can then be split
       // Use two line breaks to separate, because some video subtitles have their own line breaks
      cuesTextList[cuesTextList.length - 1][1] += '\n\n' + cues[i].text
    } else {
      cuesTextList.push([i, cues[i].text])
    }
  }
  return cuesTextList
}

function getTranslation (words, callback) {
  // Translate through the Google Translate API, enter the string to be translated, and return the translated string
  const xhr = new XMLHttpRequest()
  let url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURI(words)}`
  xhr.open('GET', url, true)
  xhr.responseType = 'text'
  xhr.onload = function () {
    if (xhr.readyState === xhr.DONE) {
      if (xhr.status === 200 || xhr.status === 304) {
        // The translated text returned is approximately
         // [[["Hello.","hello.",null,null,1],["Hello","hello",null,null,1]],null,"en"]
         // string like this
         // Need to concatenate the result into a complete whole string
        const translatedList = JSON.parse(xhr.responseText)[0]
        let translatedText = ''
        for (let i = 0; i < translatedList.length; i++) {
          translatedText += translatedList[i][0]
        }
        callback(translatedText)
      }
    }
  }
  xhr.send()
}

// Set the monitor, if a request is received, execute the function to enable bilingual subtitles
chrome.runtime.onMessage.addListener(
  function (request, sender) {
    openBilingual()
  }
)
