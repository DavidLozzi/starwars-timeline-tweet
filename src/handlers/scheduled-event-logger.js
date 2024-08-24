const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const twitterApi = require('../api/twitter');
const dynamodb = require('../api/dynamodb');


if (process.env.AWS_SAM_LOCAL === "true") {
  AWS.config.update({ region: 'us-east-2', endpoint: 'http://172.16.123.1:8000/' });
} else {
  AWS.config.update({ region: 'us-east-2' });
}

/**
 * A Lambda function that logs the payload received from a CloudWatch scheduled event.
 */
exports.scheduledEventLoggerHandler = async (event, context) => {
  const THREAD_BREAK = 'THREAD_BREAK';

  try {
    // get tweets
    const socialResp = await fetch('https://timeline.starwars.guide/socials.json')
    const tweets = await socialResp.json()
    console.log('downloaded', tweets.length, 'tweets')

    // get last tweet sent from DB
    let newTweet = null
    const lastTweetItem = await dynamodb.getLastTweet()
    // get next tweet
    if (!lastTweetItem) {
      newTweet = tweets[0]
    } else {
      const lastTweet = tweets.find(t => t.title === lastTweetItem.id.S)
      console.log('last tweet', lastTweet.title)
      const index = tweets.indexOf(lastTweet)
      if (index === tweets.length - 1) {
        newTweet = tweets[0]
      } else {
        newTweet = tweets[index + 1]
      }
    }
    console.log('new tweet')
    console.log(JSON.stringify(newTweet))

    // get image and upload to twitter
    let mediaId = null
    if (newTweet.img) {
      try {
        console.log('getting image', newTweet.img)
        const imgResp = await fetch(newTweet.img)
        const img = Buffer.from(await imgResp.arrayBuffer())
        mediaId = await twitterApi.uploadImage(img)
        console.log('UPLOADED', mediaId)
      } catch (err) {
        console.error('error uploading image', err)
      }
    }

    // send tweets
    if (newTweet.tweet.indexOf(THREAD_BREAK) > -1) {
      const thread = newTweet.tweet.split(THREAD_BREAK)
      let convoId = null
      for (let i = 0; i < thread.length; i++) {
        convoId = await twitterApi.sendTweet(thread[i], convoId, i === 0 ? mediaId : null)
      }
    } else {
      await twitterApi.sendTweet(newTweet.tweet)
    }

    // delete last tweet from db
    if (lastTweetItem) {
      await dynamodb.deleteItemById(lastTweetItem.id.S)
    }

    // add new tweet to db
    await dynamodb.putIdInDb(newTweet.title)

    response = {
      'statusCode': 200,
      'body': JSON.stringify({
        message: 'tweet sent',
        newTweet
      })
    }
  } catch (err) {
    if (err.stack) {
      console.error(err.stack.replace(/\n/g, ';'))
    }
    if (err.code) {
      console.error('api error', JSON.stringify(err))
    } else {
      console.error('func error', err);
    }
    response = {
      'statusCode': 500,
      'body': JSON.stringify({
        message: 'internal server error',
        error: { ...err }
      })
    }
  }

  return response
}
