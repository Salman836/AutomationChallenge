# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf/trello.perf.spec.js >> Trello · performance >> TRL-P-001 · per-endpoint latency budgets
- Location: tests/perf/trello.perf.spec.js:21:3

# Error details

```
Error: latency budget breached

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "GET /1/boards/{id}/actions: max 4380.3 ms exceeds the 3000 ms hard ceiling",
+ ]
```

# Test source

```ts
  8   |    * @param {number} defaultSamples per-series sample count (`PERF_SAMPLES`)
  9   |    */
  10  |   constructor(testInfo, defaultSamples) {
  11  |     this.testInfo = testInfo;
  12  |     this.defaultSamples = defaultSamples;
  13  |     /** @type {any[]} */
  14  |     this.rows = [];
  15  |   }
  16  | 
  17  |   /** One timed call. */
  18  |   static async time(call) {
  19  |     const started = performance.now();
  20  |     const response = await call();
  21  |     return { response, ms: performance.now() - started };
  22  |   }
  23  | 
  24  |   /** Turn raw latencies into a judged row and keep it for the report. */
  25  |   add(label, samples, { errors = 0, budget = BUDGETS[label], dropColdStart = true } = {}) {
  26  |     const summary = summarize(label, samples, { errors, dropColdStart });
  27  |     const { status, reasons } = judge(summary, budget);
  28  |     const row = { ...summary, budget: budget ?? null, status, reasons };
  29  |     this.rows.push(row);
  30  |     return row;
  31  |   }
  32  | 
  33  |   /**
  34  |    * A non-2xx is counted rather than thrown: the error rate is part of the
  35  |    * measurement, and one blip should not discard the whole series.
  36  |    */
  37  |   async series(label, call, { samples = this.defaultSamples, ...options } = {}) {
  38  |     const latencies = [];
  39  |     let errors = 0;
  40  | 
  41  |     for (let i = 0; i < samples; i += 1) {
  42  |       const { response, ms } = await PerfRun.time(() => call(i));
  43  |       latencies.push(ms);
  44  |       if (!response.ok()) errors += 1;
  45  |     }
  46  |     return this.add(label, latencies, { errors, ...options });
  47  |   }
  48  | 
  49  |   /**
  50  |    * Measure a create and its matching delete together.
  51  |    * Taking 20 samples of a create without deleting would leave 20 entities behind,
  52  |    * and a Trello Free workspace caps open boards — the measurement would start
  53  |    * failing for a reason that has nothing to do with latency. Pairing keeps at most
  54  |    * one alive at a time and yields the delete series for free.
  55  |    */
  56  |   async pairedSeries({ create, remove }, createLabel, removeLabel, { samples = this.defaultSamples } = {}) {
  57  |     const creates = [];
  58  |     const removes = [];
  59  |     let createErrors = 0;
  60  |     let removeErrors = 0;
  61  | 
  62  |     for (let i = 0; i < samples; i += 1) {
  63  |       const created = await PerfRun.time(() => create(i));
  64  |       creates.push(created.ms);
  65  |       if (!created.response.ok()) {
  66  |         createErrors += 1;
  67  |         continue;
  68  |       }
  69  | 
  70  |       const { id } = await created.response.json();
  71  |       const removed = await PerfRun.time(() => remove(id));
  72  |       removes.push(removed.ms);
  73  |       if (!removed.response.ok()) removeErrors += 1;
  74  |     }
  75  | 
  76  |     this.add(createLabel, creates, { errors: createErrors });
  77  |     this.add(removeLabel, removes, { errors: removeErrors });
  78  |   }
  79  | 
  80  |   /**
  81  |    * Time a whole multi-call flow, repeated.
  82  |    * Unlike `series` this lets a failure throw: a workflow that cannot complete is a
  83  |    * broken test, not a slow one, and recording it as "20% error rate" would bury it.
  84  |    * There is no cold start to drop — global setup already warmed the connection.
  85  |    */
  86  |   async flow(label, run, { repetitions = 5, ...options } = {}) {
  87  |     const latencies = [];
  88  |     for (let i = 0; i < repetitions; i += 1) {
  89  |       const started = performance.now();
  90  |       await run(i);
  91  |       latencies.push(performance.now() - started);
  92  |     }
  93  |     return this.add(label, latencies, { dropColdStart: false, ...options });
  94  |   }
  95  | 
  96  |   /** Attach the run's measurements, then fail on every breached budget at once. */
  97  |   async publish() {
  98  |     await attachPerf(this.testInfo, { summaries: this.rows });
  99  |     await this.testInfo.attach('perf-table', {
  100 |       contentType: 'text/markdown',
  101 |       body: Buffer.from(markdownTable(this.rows))
  102 |     });
  103 | 
  104 |     const breaches = this.rows.filter((row) => row.status === 'FAIL');
  105 |     expect(
  106 |       breaches.map((row) => `${row.label}: ${row.reasons.join('; ')}`),
  107 |       'latency budget breached'
> 108 |     ).toEqual([]);
      |       ^ Error: latency budget breached
  109 |   }
  110 | }
  111 | 
```