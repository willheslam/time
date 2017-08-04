import * as most from 'most';
import {Stream} from 'most';
import {setAdapt} from '@cycle/run/lib/adapt';

import {mockTimeSource as mockTimeSourceUntyped} from './dist/mock-time-source';
import {timeDriver as timeDriverUntyped} from './dist/time-driver';
import {Frame} from './dist/animation-frames';
import {TimeSource, timeDriver} from './most';

setAdapt(stream => most.from(stream as any));

type Operator = <T>(stream: Stream<T>) => Stream<T>;

interface MockTimeSource extends TimeSource {
  diagram (str: string, values?: Object): Stream<any>;
  record (stream: Stream<any>): Stream<Array<any>>;
  assertEqual (actual: Stream<any>, expected: Stream<any>): void;
  run (cb?: (err?: Error) => void): void;
}

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
