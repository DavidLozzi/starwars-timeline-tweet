const AWS = require('aws-sdk');
if (process.env.AWS_SAM_LOCAL === "true") {
  AWS.config.update({ region: 'us-east-2', endpoint: 'http://172.16.123.1:4566/' });
} else {
  AWS.config.update({ region: 'us-east-2' });
}
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

const getLastTweet = async () => {
  try {
    console.info('getting last tweet from dynamo', process.env.TABLE_NAME, 'local:', process.env.AWS_SAM_LOCAL)
    const dbItems = await ddb.scan({ TableName: process.env.TABLE_NAME }).promise()
    dbItems.Items.forEach(d => console.log(d.id.S))
    let lastTweetItem = null
    if (dbItems.Items.length > 0) {
      lastTweetItem = dbItems.Items[0]
    }
    return lastTweetItem;
  } catch (ex) {
    console.error('getLastTweet', ex.toString())
    throw ex
  }
}

const deleteItemById = async (id) => {
  try {
    console.log("deleting", id, "from database")
    const delParams = {
      TableName: process.env.TABLE_NAME,
      Key: {
        id: {
          S: id
        }
      }
    };
    await ddb.deleteItem(delParams).promise()
  } catch (ex) {
    console.error('deleteItemById', ex.toString())
    throw ex
  }
}

const putIdInDb = async (id) => {
  try {
    console.log("writing", id, "database")
    const putParams = {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: {
          S: id
        }
      }
    }
    await ddb.putItem(putParams).promise()
  } catch (ex) {
    console.error('putIdInDb', ex.toString())
    throw ex
  }
}

module.exports = { getLastTweet, deleteItemById, putIdInDb };