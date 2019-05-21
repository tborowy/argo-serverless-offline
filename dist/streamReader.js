"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var aws_sdk_1 = require("aws-sdk");
var Bluebird = require("bluebird");
var _ = require("lodash");
var StreamReader = /** @class */ (function () {
    function StreamReader(config) {
        var _this = this;
        this.getTableName = function (event) { return event.arn['Fn::GetAtt'][0]; };
        this.getAllStreams = function (options) {
            if (options === void 0) { options = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                var currentResult;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.dynamoStream.listStreams(options).promise()];
                        case 1:
                            currentResult = _a.sent();
                            // Todo: dynamoStream.listStreams returns 100 elements, for more use options;
                            // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_ListStreams.html
                            this.streams = this.streams.concat(currentResult.Streams);
                            return [2 /*return*/];
                    }
                });
            });
        };
        this.getDescribes = function (params) {
            return _this.dynamoStream.describeStream(params).promise().then(function (res) { return res.StreamDescription; });
        };
        this.getStreamsDescribes = function () {
            if (!_this.streams.length) {
                console.info('Expect streams but dynamoDB returns empty streams table');
                return [];
            }
            return Bluebird.map(_this.streams, function (item) { return _this.getDescribes({ StreamArn: item.StreamArn }); });
        };
        this.filterStream = function (streams) {
            var tables = _.keys(_this.events);
            return _.filter(streams, function (item) { return 'ENABLED' === item.StreamStatus && tables.includes(item.TableName); });
        };
        this.getShardIterators = function (data) {
            return Bluebird.map(data, function (StreamDescription) { return _this.dynamoStream.getShardIterator({
                ShardId: StreamDescription.Shards[0].ShardId,
                ShardIteratorType: 'TRIM_HORIZON',
                StreamArn: StreamDescription.StreamArn
            }).promise(); });
        };
        this.saveShards = function (shards) {
            _this.shards = _.map(shards, function (shard) { return shard.ShardIterator; });
        };
        this.getAllRecords = function () {
            var handleGetAllRecordsError = function (e, ShardIterator) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    console.warn('getAllRecords error:', e);
                    console.info('INVALID SHARD!', ShardIterator);
                    return [2 /*return*/, null];
                });
            }); };
            return Bluebird.map(_this.shards, function (ShardIterator) {
                return _this.dynamoStream.getRecords({ ShardIterator: ShardIterator })
                    .promise()
                    .catch(function (e) { return handleGetAllRecordsError(e, ShardIterator); });
            });
        };
        this.parseStreamData = function (StreamsData) {
            _this.shards = _.map(StreamsData, function (item) { return item && item.NextShardIterator || null; });
            return Bluebird.map(StreamsData, function (stream) {
                var arn = StreamReader.getARNFromShardIterator(stream.NextShardIterator);
                var streamDefinition = _.find(_this.streams, { StreamArn: arn });
                if (!stream || 0 === (stream.Records && stream.Records.length)) {
                    return "Stream for " + streamDefinition.TableName + " not have records";
                }
                console.info("Call " + (_this.events[streamDefinition.TableName].length || 0) + " handlers for " + stream.Records.length + " " +
                    ("items in " + streamDefinition.TableName + " streams"));
                stream.Records = _.map(stream.Records, function (record) { return (__assign({}, record, { TableName: streamDefinition.TableName, eventSourceARN: streamDefinition.StreamArn })); });
                return Bluebird.map(_this.events[streamDefinition.TableName], function (_a) {
                    var handler = _a.handler, functionName = _a.functionName;
                    return new Promise(function (resolve) {
                        return handler(stream, undefined, function (err, success) {
                            return resolve("HANDLER " + functionName + " for " + streamDefinition.TableName + " END WORK with err: " + err + ", success: " + success);
                        });
                    });
                });
            });
        };
        this.checkShards = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (-1 !== _.findIndex(this.shards, function (i) { return null === i; })) {
                    throw new Error('Some Shards are invalid');
                }
                return [2 /*return*/];
            });
        }); };
        this.handleError = function (e) {
            console.info('- - - - - - - - - - E R R O R - - - - - - - - - -');
            console.warn(e);
            clearInterval(_this.intervalID);
            setTimeout(function () {
                console.info('RESTART');
                _this.connect();
            }, 1000);
            _this.isRunning = false;
            _this.streams = [];
            _this.shards = [];
        };
        this.getStreamData = function () {
            _this.checkShards()
                .then(_this.getAllRecords)
                .then(_this.parseStreamData)
                .then(function (logs) {
                console.info('- - - - - - - - - - STREAM LOGS - - - - - - - - - -');
                console.info(logs);
                console.info('- - - - - - - - - - END LOGS - - - - - - - - - -');
            })
                .catch(_this.handleError);
        };
        var options = {
            accessKeyId: process.env.AWS_DYNAMODB_ACCESS_KEY,
            apiVersion: '2012-08-10',
            endpoint: process.env.AWS_DYNAMODB_ENDPOINT,
            region: process.env.REGION,
            secretAccessKey: process.env.AWS_DYNAMODB_SECRET_ACCESS_KEY
        };
        this.dynamoStream = new aws_sdk_1.DynamoDBStreams(options);
        this.events = {};
        this.interval = config.interval || 1000;
        this.streams = [];
        this.isRunning = false;
    }
    StreamReader.prototype.registerHandler = function (event, handler, functionName) {
        if ('dynamodb' !== event.type) {
            return;
        }
        var tableName = this.getTableName(event);
        this.events[tableName] = this.events[tableName] || [];
        this.events[tableName].push({ handler: handler, functionName: functionName });
    };
    StreamReader.prototype.connect = function () {
        var _this = this;
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        console.info('- - - - - - - - - - START - - - - - - - - - -');
        this.getAllStreams()
            .then(this.getStreamsDescribes)
            .then(this.filterStream)
            .then(this.getShardIterators)
            .then(this.saveShards)
            .then(function () {
            _this.intervalID = setInterval(function () { return _this.getStreamData(); }, _this.interval);
        })
            .catch(this.handleError);
    };
    StreamReader.getARNFromShardIterator = function (id) { return id.substring(id.indexOf('|') + 1, id.lastIndexOf('|')); };
    return StreamReader;
}());
exports.StreamReader = StreamReader;
//# sourceMappingURL=streamReader.js.map