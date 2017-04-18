import * as assert from 'assert';
import {makeTestHelper, mockTimeSource, timeDriver} from '../../src/';
import {mockDOMSource} from '@cycle/dom';
import xs, {Stream} from 'xstream';
import {setAdapt} from '@cycle/run/lib/adapt';
import {Observable} from 'rxjs/Rx';
import * as most from 'most';

const libraries = [
  {name: 'xstream', adapt: stream => stream, lib: xs},
  {name: 'rxjs', adapt: stream => Observable.from(stream), lib: Observable},
  {name: 'most', adapt: stream => most.from(stream), lib: most}
];

function compose (stream, f) {
  if ('compose' in stream) {
    return stream.compose(f);
  }

  if ('let' in stream) {
    return stream.let(f);
  }

  if ('thru' in stream) {
    return stream.thru(f);
  }

  throw new Error(`Don't know how to compose`);
}

const withTime = makeTestHelper();

describe("@cycle/time", () => {
  before(() => setAdapt(stream => stream));

  it("can be used to test Cycle apps", withTime((Time) => {
    function Counter ({DOM}) {
      const add$ = DOM
        .select('.add')
        .events('click')
        .mapTo(+1);

      const subtract$ = DOM
        .select('.subtract')
        .events('click')
        .mapTo(-1);

      const change$ = xs.merge(add$, subtract$);

      const add = (a, b) => a + b;

      const count$ = change$.fold(add, 0);

      return {
        count$
      }
    }

    const addClick      = '---x-x-x------x-|';
    const subtractClick = '-----------x----|';

    const expectedCount = '0--1-2-3---2--3-|';

    const DOM = mockDOMSource({
      '.add': {
        'click': Time.diagram(addClick)
      },
      '.subtract': {
        'click': Time.diagram(subtractClick)
      }
    });

    const counter = Counter({DOM});

    Time.assertEqual(
      counter.count$,
      Time.diagram(expectedCount)
    );
  }));

  libraries.forEach(library => {
    describe(library.name, () => {
      before(() => setAdapt(library.adapt));

      describe("mockTimeSource", () => {
        describe(".diagram", () => {
          it("creates streams from ascii diagrams", (done) => {
            const Time = mockTimeSource();

            const stream = Time.diagram(
              `---1---2---3---|`
            );

            const expectedValues = [1, 2, 3];

            stream.take(expectedValues.length).subscribe({
              next (ev) {
                assert.equal(ev, expectedValues.shift());
              },

              complete: () => done(),
              error: done
            });

            Time.run();
          });

          it("schedules errors", (done) => {
            const Time = mockTimeSource();

            const stream = Time.diagram(
              `---1---2---#`
            );

            const expectedValues = [1, 2];

            stream.subscribe({
              next (ev) {
                assert.equal(ev, expectedValues.shift());
              },

              complete: () => {},
              error: (error) => {
                assert.equal(expectedValues.length, 0);
                done();
              }
            });

            Time.run();
          });

          it("optionally takes an object of values", (done) => {
            const Time = mockTimeSource();

            const stream = Time.diagram(
              `---A---B---C---|`,
              {
                A: {foo: 1},
                B: {foo: 2},
                C: {foo: 3}
              }
            );

            const expectedValues = [
              {foo: 1},
              {foo: 2},
              {foo: 3}
            ];

            stream.take(expectedValues.length).subscribe({
              next (ev) {
                assert.deepEqual(ev, expectedValues.shift());
              },

              complete: () => done(),
              error: done
            });

            Time.run();
          });

          it("handles multiple events in a single frame", withTime((Time) => {
            const a        = Time.diagram('---a---');
            const b        = Time.diagram('---b---');
            const expected = Time.diagram('---(ab)---');

            Time.assertEqual((library.lib as any).merge(a, b), expected);
          }));
        });

        describe(".assertEqual", () => {
          it("allows testing via marble diagrams", withTime((Time) => {
            const input = Time.diagram(
              `---1---2---3---|`
            );

            const value = input.map(i => i * 2);

            const expected = Time.diagram(
              `---2---4---6---|`
            );

            Time.assertEqual(
              value,
              expected
            );
          }));

          it("fails when actual differs from expected", (done) => {
            const Time = mockTimeSource();

            const input = Time.diagram(
              `---1---2---3---|`
            );

            const expected = Time.diagram(
              `---2---4---5---|`
            );

            const value = input.map(i => i * 2);

            const complete = (err) => {
              if (err) {
                const lines = err.message.split(/\s+/).filter(a => a.length > 0);

                assert([
                  'Expected',
                  '---2---4---5---|',
                  'Got',
                  '---2---4---6---|',
                ].every(expectedLine => lines.indexOf(expectedLine) !== -1), err.message);

                done();
              } else {
                throw new Error('expected test to fail');
              }
            }

            Time.assertEqual(
              value,
              expected
            );

            Time.run(complete);
          });

          it("stringifies objects", (done) => {
            const Time = mockTimeSource();

            const input = Time.diagram(
              `---1---2---3---|`
            );

            const expected = Time.diagram(
              `---a-------b---|`,
              {a: {a: 1}, b: {a: 2}}
            );

            const complete = (err) => {
              if (err) {
                const lines = err.message.split(/\s+/).filter(a => a.length > 0);

                assert([
                  'Expected',
                  '---{"a":1}-------{"a":2}---|',
                  'Got',
                  '---1---2---3---|',
                ].every(expectedLine => lines.indexOf(expectedLine) !== -1));

                done();
              } else {
                throw new Error('expected test to fail');
              }
            }

            Time.assertEqual(
              input,
              expected
            );

            Time.run(complete);
          });

          it("handles errors", withTime((Time) => {
            const stream = xs.throw(new Error('Test!'));
            const expected = '#';

            Time.assertEqual(
              stream,
              Time.diagram(expected)
            );
          }));

          it("compares objects using deep equality by default", withTime((Time) => {
            const actual = Time.diagram(
              `---A---B---C---|`,
              {
                A: {foo: 1},
                B: {foo: 2},
                C: {foo: 3}
              }
            );

            const expected = Time.diagram(
              `---X---Y---Z---|`,
              {
                X: {foo: 1},
                Y: {foo: 2},
                Z: {foo: 3}
              }
            );

          }));

          describe("custom equality functions", () => {
            it("passes", withTime((Time) => {
              const actual$ = Time.diagram(
                `---A---B---C---|`,
                {
                  A: {foo: 1, bar: 2},
                  B: {foo: 2, bar: 4},
                  C: {foo: 3, bar: 6}
                }
              );

              const expected$ = Time.diagram(
                `---X---Y---Z---|`,
                {
                  X: {foo: 1, bar: 3},
                  Y: {foo: 2, bar: 4},
                  Z: {foo: 3, bar: 6}
                }
              );

              function comparator (actual, expected) {
                return actual.foo === expected.foo
              }

            }));

            it("fails", (done) => {
              const Time = mockTimeSource();

              const actual$ = Time.diagram(
                `---A---B---C---|`,
                {
                  A: {foo: 1, bar: 2},
                  B: {foo: 2, bar: 4},
                  C: {foo: 3, bar: 6}
                }
              );

              const expected$ = Time.diagram(
                `---X---Y---Z---|`,
                {
                  X: {foo: 5, bar: 3},
                  Y: {foo: 2, bar: 4},
                  Z: {foo: 3, bar: 6}
                }
              );

              function comparator (actual, expected) {
                return actual.foo === expected.foo
              }

              Time.assertEqual(actual$, expected$, comparator);

              Time.run((err) => {
                if(!err) {
                  done(new Error('expected test to fail'));
                } else {
                  done();
                }
              });
            });

            it("logs errors", (done) => {
              const Time = mockTimeSource();

              const actual$ = Time.diagram(
                `---A---B---C---|`,
                {
                  A: {foo: 1, bar: 2},
                  B: {foo: 2, bar: 4},
                  C: {foo: 3, bar: 6}
                }
              );

              const expected$ = Time.diagram(
                `---X---Y---Z---|`,
                {
                  X: {foo: 5, bar: 3},
                  Y: {foo: 2, bar: 4},
                  Z: {foo: 3, bar: 6}
                }
              );

              function comparator (actual, expected) {
                if (actual.foo !== expected.foo) {
                  throw new Error("Something went wrong");
                }
              }

              Time.assertEqual(actual$, expected$, comparator);

              Time.run((err) => {
                if (!err) {
                  done(new Error("expected test to fail"));
                }

                assert(
                  err.message.indexOf("Something went wrong") !== -1,
                  [
                    "Expected failure message to include error, did not:",
                    err.message,
                    "to include:",
                    "Something went wrong"
                  ].join('\n\n')
                );

                done();
              });
            });
          });

          it("logs unexpected errors", (done) => {
            const Time = mockTimeSource();

            const input$ = Time.diagram(
              `---A---B---C---|`
            );

            const expectedError = 'Something went unexpectedly wrong!';

            function transformation (character) {
              if (character === 'A') {
                return 'X';
              }

              if (character === 'B') {
                throw new Error(expectedError);
              }
            }

            const actual$ = input$.map(transformation);

            const expected$ = Time.diagram(
              `---X---Y---Z---|`
            );

            Time.assertEqual(actual$, expected$);
            Time.run((err) => {
              if (!err) {
                done(new Error('expected test to fail'));
              }

              assert(
                err.message.indexOf(expectedError) !== -1,
                [
                  'Expected failure message to include error, did not:',
                  err.message,
                  'to include:',
                  expectedError
                ].join('\n\n')
              );

              done();
            });
          });

          it("handles infinite streams", withTime((Time) => {
            const input    = Time.diagram('---1---2---3---');
            const actual   = input.map(i => i * 2);
            const expected = Time.diagram('---2---4---6---');

            Time.assertEqual(actual, expected);
          }));

          it("handles infinite streams that have failures", (done) => {
            const Time = mockTimeSource();

            const input    = Time.diagram('---1---2---3---');
            const actual   = input.map(i => i * 2);
            const expected = Time.diagram('---2---7---6---');

            Time.assertEqual(actual, expected);

            Time.run((err) => {
              if (!err) {
                return done(new Error('expected test to fail'));
              }

              done();
            });
          });

          it("displays simultaneous events correcly", (done) => {
            const Time = mockTimeSource();

            const input    = `---(11)---(22)---(33)---|`;
            const expected = `---(11)---(22)---(34)---|`;

            const complete = (err) => {
              if (err) {
                const lines = err.message.split(/\s+/).filter(a => a.length > 0);

                assert([
                  'Expected',
                  expected,
                  'Got',
                  input
                ].every(expectedLine => lines.indexOf(expectedLine) !== -1));

                done();
              } else {
                throw new Error('expected test to fail');
              }
            }

            Time.assertEqual(
              Time.diagram(input),
              Time.diagram(expected)
            );

            Time.run(complete);
          });
        });

        describe(".periodic", () => {
          it("creates a stream that emits every period ms", withTime((Time) => {
            const stream = Time.periodic(80);

            const expected = Time.diagram(
              `----0---1---2---3---4---`
            );

            Time.assertEqual(
              stream,
              expected
            );
          }));
        });

        describe(".delay", () => {
          it("delays events by the given period", withTime((Time) => {
            const input = Time.diagram(
              `---1---2---3---|`
            ) as any;

            const expected = Time.diagram(
              `------1---2---3---|`
            );

            const value = compose(input, Time.delay(60));

            Time.assertEqual(
              value,
              expected
            );
          }));

          it("propagates errors", withTime((Time) => {
            const stream = compose(xs.throw(new Error('Test!')), Time.delay(60));
            const expected = '---#';

            Time.assertEqual(
              stream,
              Time.diagram(expected)
            );
          }));
        })

        describe(".debounce", () => {
          it("delays events until the period has passed", withTime((Time) => {
            const input    = `--1----2-3----|`;
            const expected = `-----1------3-|`;

            const stream = compose(Time.diagram(input), Time.debounce(60));
            const expectedStream = Time.diagram(expected);

            Time.assertEqual(
              stream,
              expectedStream
            );
          }));

          it("propagates errors", withTime((Time) => {
            const stream   = Time.diagram('---1-2---3-#');
            const expected = Time.diagram('--------2--#');

            Time.assertEqual(
              compose(stream, Time.debounce(60)),
              expected
            );
          }));
        });

        describe(".throttle", () => {
          it("only allows one event per period", withTime((Time) => {
            const input    = `--1-2-----3--4-5---6-|`;
            const expected = `--1-------3----5---6-|`;
            const stream = compose(Time.diagram(input), Time.throttle(60));
            const expectedStream = Time.diagram(expected);

            Time.assertEqual(
              stream,
              expectedStream
            );
          }));

          it("propagates errors", withTime((Time) => {
            const stream   = Time.diagram('---1-2---3-#');
            const expected = Time.diagram('---1-----3-#');

            Time.assertEqual(
              compose(stream, Time.throttle(60)),
              expected
            );
          }));
        });

        describe('.animationFrames', () => {
          it('provides a stream of frames for animations', withTime((Time) => {
            const frames = [0, 1, 2].map(i => (
              {
                time: i * 16,
                delta: 16,
                normalizedDelta: 1
              }
            ));

            const actual$ = Time.animationFrames()
            const expected$ = Time.diagram(
              `--0-1-2`,
              frames
            );

            Time.assertEqual(actual$, expected$);
          }, {interval: 8}));
        });

        describe('.throttleAnimation', () => {
          it('throttles a stream using animationFrames', withTime((Time) => {
            const noisy$    = Time.diagram(`-123456----`);
            const actual$   = compose(noisy$, Time.throttleAnimation);
            const expected$ = Time.diagram(`--2-4-6----`);

            Time.assertEqual(actual$, expected$);
          }, {interval: 8}));
        });

        describe('.record', () => {
          it('records a stream into an array of entries', withTime((Time) => {
            const expectedNextEntry = {type: 'next', time: 60, value: 'a'};
            const expectedCompletionEntry = {type: 'complete', time: 140};

            const input$    = Time.diagram(`---a---|`);

            const actual$   = compose(input$, Time.record);
            const expected$ = Time.diagram(`x--y---(z|)`, {
              x: [],
              y: [expectedNextEntry],
              z: [expectedNextEntry, expectedCompletionEntry]
            });

            Time.assertEqual(
              actual$,
              expected$
            );
          }));

          it('records errors', withTime((Time) => {
            const expectedErrorEntry = {type: 'error', time: 60, error: new Error(`scheduled error`)};

            const input$    = Time.diagram(`---#`);

            const actual$   = compose(input$, Time.record);
            const expected$ = Time.diagram(`x--(y|)`, {
              x: [],
              y: [expectedErrorEntry]
            });

            Time.assertEqual(
              actual$,
              expected$
            );
          }));
        })
      });
    });
  });
});