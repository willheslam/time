import * as most from 'most';
import {Stream} from 'most';
import {setAdapt} from '@cycle/run/lib/adapt';

import {timeDriver as timeDriverUntyped} from './dist/time-driver';
import {Frame} from './dist/animation-frames';

setAdapt(stream => most.from(stream as any));

type Operator = <T>(stream: Stream<T>) => Stream<T>;

interface TimeSource {
  animationFrames (): Stream<Frame>;
  delay (delayTime: number): Operator;
  debounce (period: number): Operator;
  throttle (period: number): Operator;
  periodic (period: number): Stream<number>;
  throttleAnimation: Operator;
}

function timeDriver (_, adapter): TimeSource {
  return timeDriverUntyped(_, adapter);
}

export {
  Operator,

  TimeSource,
  timeDriver,
};
