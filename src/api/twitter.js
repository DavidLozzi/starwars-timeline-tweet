const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const got = require('got');
const FormData = require('form-data');
const { getTwitterSecrets } = require('./secrets');

const getTwitterAuthHeader = async (requestUrl, method) => {
  const twitterSecret = await getTwitterSecrets();

  const oauth = OAuth({
    consumer: {
      key: twitterSecret.API_KEY,
      secret: twitterSecret.API_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto
        .createHmac('sha1', key)
        .update(base_string)
        .digest('base64');
    },
  });

  const token = {
    key: twitterSecret.ACCESS_TOKEN,
    secret: twitterSecret.TOKEN_SECRET,
  };

  const request_data = {
    url: requestUrl,
    method: method,
  };

  const authHeader = oauth.toHeader(oauth.authorize(request_data, token));

  return authHeader.Authorization;
};
const MAX_TWEET_LEN = 280
const reduceByDelim = (tweet, delim) => {
  let newTweet = tweet
  while (Buffer.byteLength(newTweet, 'utf8') > MAX_TWEET_LEN) {
    const removeMe = newTweet.lastIndexOf(delim)
    if (removeMe > 0) {
      newTweet = newTweet.slice(0, removeMe)
      console.log('reducing', tweet, 'to', newTweet, 'using', delim, 'removed at', removeMe)
    } else {
      break
    }
  }
  return newTweet
}

const trimTweet = (tweet) => {
  if (Buffer.byteLength(tweet, 'utf8') <= MAX_TWEET_LEN) {
    return tweet
  }
  console.log('trimming by #')
  let newTweet = reduceByDelim(tweet, '#')
  if (Buffer.byteLength(newTweet, 'utf8') <= MAX_TWEET_LEN) {
    return newTweet
  }
  console.log('trimming by space')
  newTweet = reduceByDelim(tweet, ' ')
  if (Buffer.byteLength(newTweet, 'utf8') <= MAX_TWEET_LEN) {
    return newTweet
  }
  return tweet.slice(0, MAX_TWEET_LEN)
}

const sendTweet = async (tweet, convoId, mediaId) => {
  console.log('tweeting', tweet.length, 'characters')
  try {
    const newTweet = trimTweet(tweet)

    const payload = { text: newTweet }

    if (convoId) {
      payload.reply = {
        in_reply_to_tweet_id: convoId
      }
    }
    if (mediaId) {
      payload.media = { media_ids: [mediaId] }
    }
    const url = 'https://api.twitter.com/2/tweets'
    const Authorization = await getTwitterAuthHeader(url, 'POST')
    console.log(payload)
    const resp = await got.post(url, {
      json: payload,
      headers: {
        Authorization,
        'Content-Type': "application/json",
        'Accept': "application/json"
      }
    })
    if (!resp.body) {
      console.error('sendTweet', JSON.stringify(resp.code))
      throw resp
    }
    console.log('tweet sent', resp.body)
    return JSON.parse(resp.body).data.id
  } catch (ex) {
    console.error('Error sending tweet:', ex.response?.body ? JSON.stringify(ex.response.body) : ex.toString());
    if (ex.response?.body?.errors) {
      ex.response.body.errors.forEach(err => {
        console.error(`Twitter API error: ${err.detail}`);
      });
    }
    throw ex;
  }
}


const uploadImage = async (imgBase64) => {
  try {
    const Authorization = await getTwitterAuthHeader('https://upload.twitter.com/1.1/media/upload.json', 'POST')

    const formData = new FormData()
    formData.append('media', imgBase64)

    const twImg = await got.post('https://upload.twitter.com/1.1/media/upload.json', {
      body: formData,
      headers: {
        Authorization,
        ...formData.getHeaders()
      },
      responseType: 'json'
    })
    console.log(twImg.body)
    if (twImg.body.errors) {
      console.error('uploadImage', twImg.body.errors[0]);
      throw twImg.body.errors[0];
    }
    return twImg.body.media_id_string;
  } catch (ex) {
    console.error('uploadImage', ex.toString())
    throw ex
  }
}

module.exports = { sendTweet, uploadImage }