import {timeDriver as timeDriverUntyped} from './time-driver';
import {mockTimeSource as mockTimeSourceUntyped} from './mock-time-source';
import {TimeSource, MockTimeSource, Operator} from './time-source';
import {timeDriver} from './index';

function mockTimeSource (args?: Object): MockTimeSource {
  return mockTimeSourceUntyped(args);
}



export {
  Operator,

  TimeSource,
  timeDriver,

  MockTimeSource,
  mockTimeSource
};
