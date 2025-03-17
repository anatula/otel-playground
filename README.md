#  Notes from [LSF148](https://trainingportal.linuxfoundation.org/courses/getting-started-with-opentelemetry-lfs148)

In 2010, Google developed [Dapper](https://research.google.com/pubs/pub36356.html?spm=5176.100239.blogcont60165.11.OXME9Z), which popularized the concept of distributed tracing.

##  What is OpenTelemetry?
OTel is an open source project designed to provide standardized tools and APIs for generating, collecting, and exporting telemetry data such as traces, metrics, and logs.

OpenTelemetry is organized into signals, each developed as a standalone component (but there are ways to connect them). 
Signals are defined inside a language-agnostic  [spec](https://opentelemetry.io/docs/specs/).

## Spec
The spec consists of three parts: 
- definitions of terms that establish a common vocabulary
- API specification ([Tracing API](https://opentelemetry.io/docs/specs/otel/trace/api/), Metrics API, and OpenTelemetry Logging): defines the interfaces and constants outlined in the specification, used by application and library developers for vendor-agnostic instrumentation
(refers to a no-op implementation by default)
- SDK specification (see [Tracing SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/), Metrics SDK, Logs SDK): provider implements the OpenTelemetry API, it contains the actual logic to generate, process and emit telemetry. OpenTelemetry ships with official providers that serve as the reference implementation (commonly referred to as the SDK). It's is possible to write a custom one.

Besides signal architecture, the spec also covers 
- [Semantic conventions](https://opentelemetry.io/docs/specs/semconv/) for consistency in the naming and interpretation of common telemetry metadata, OpenTelemetry aims to reduce the need to normalize data coming from different sources. -
- OpenTelemetry Protocol ([OTLP](https://opentelemetry.io/docs/specs/otlp/)) Emitting telemetry in OLTP means that instrumented applications and third-party services are compatible with countless observability solutions. OTLP offers three transport mechanisms for transmitting telemetry data: HTTP/1.1, HTTP/2, and gRPC. OTLP data is often encoded using the Protocol Buffers (Protobuf) binary format, which is compact and efficient for network transmission and supports schema evolution, allowing for future changes to the data model without breaking compatibility. Data can also be encoded in the JSON file format.

### API and SDK
Separation the API from the SDK: the API is designed to be lightweight and safe to depend on. The signal’s implementation provided by the SDK is significantly more complex and likely contains dependencies on other software, so registering a provider during the initial setup allows users to resolve dependency conflicts by choosing a different implementation.


## Instrumentation
To add instrumentation to the source code:

- Automatic Instrumentation: Uses agents to dynamically instrument applications without code changes.
- Instrumentation Libraries: Separate libraries that add OpenTelemetry API calls to frameworks lacking native support.
- Manual Instrumentation: Involves directly modifying source code to integrate OpenTelemetry for detailed control.

### Resource object in OpenTelemetry

A [resource](https://opentelemetry.io/docs/concepts/resources/) is a set of static attributes that help us identify the source (and location) that captured a piece of telemetry. Sometimes, it only contains basic information about the SDK itself but we can add additional properties. OpenTelemetry provides a Python package `opentelemetry-semantic-conventions` so we can add the `ResourceAttributes.SERVICE_NAME` property.


### Manual instrumentation Traces

A [span](https://opentelemetry.io/docs/concepts/signals/traces/#spans) represents a single operation within a trace and carries a wealth of information that provides insight into the operation’s execution. This includes: 
- Name of the span, which is a human-readable string that describes the operation.
- Trace context, consisting of the trace_id, span_id, and trace_state, uniquely identifies the span within the trace and carries system-specific configuration data
- SpanKind indicates the role of the span, such as whether it’s an internal operation, a server-side operation, or a client-side operation
- parent_id is null, it signifies that the span is the root of a new trace.
- The start_time and end_time timestamps mark the beginning and end of the span’s duration.

Additionally, spans can contain attributes that provide further context, such as HTTP methods or response status codes, and a resource field that describes the service and environment. Other fields like events, links, and status offer additional details about the span’s lifecycle, outcome and context.

#### Configure the Tracing Pipeline and Obtain a Tracer

```
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, BatchSpanProcessor

def create_tracing_pipeline() -> BatchSpanProcessor:

      console_exporter = ConsoleSpanExporter()
      span_processor = BatchSpanProcessor(console_exporter)
      return span_processor
```

ConsoleSpanExporter write spans straight to the console. Next, a SpanProcessor is created that sits at the end of our pipeline. Its main responsibility is to push spans to one (or more) SpanExporter(s). There are different ways to achieve this:

- Synchronous: Blocks the program execution to forward spans as soon as they are generated. Means that tracing instrumentation adds additional latency to requests
- Asynchronous: Application starts and closes spans, but immediately resumes execution. Via a BatchSpanProcessor it maintains a buffer for completed spans. A separate thread is launched that flushes batches of spans to exporters at regular intervals (or when a threshold is met). Has performance advantages, but spans might be dropped if the application crashes before spans are exported or when the buffer capacity is met

For example for Node.js: By default, the Node SDK uses the BatchSpanProcessor, and this span processor is also chosen in the Web SDK example. The BatchSpanProcessor processes spans in batches before they are exported. This is usually the right processor to use for an application. In contrast, the SimpleSpanProcessor processes spans as they are created. This means that if you create 5 spans, each will be processed and exported before the next span is created in code. This can be helpful in scenarios where you do not want to risk losing a batch, or if you’re experimenting with OpenTelemetry in development. However, it also comes with potentially significant overhead, especially if spans are being exported over a network - each time a call to create a span is made, it would be processed and sent over a network before your app’s execution could continue.
In most cases, stick with BatchSpanProcessor over SimpleSpanProcessor.
[Picking the right span processor](https://opentelemetry.io/docs/languages/js/instrumentation/#picking-the-right-span-processor)


The next step by importing OpenTelemetry’s tracing API and the TracerProvider from the SDK. Then, we’ll create a function called create_tracer and instantiate a TracerProvider. To connect the provider to the tracing pipeline, we call the add_span_processor and pass the BatchSpanProcessor.

By default, the OpenTelemetry API calls a **no-op implementation**. The API provides a set_tracer_provider function to register a TracerProvider and call the tracing SDK instead. Finally, we call get_tracer to obtain a Tracer from the tracing provider. The tracer is what we’ll use to generate spans. We’ll also pass the service name and version as parameters, to uniquely identify the instrumentation.

```
# OTel API
from opentelemetry import trace as trace_api

# OTel SDK
from opentelemetry.sdk.trace import TracerProvider

def create_tracer(name: str, version: str) -> trace_api.Tracer:

    provider = TracerProvider()
    provider.add_span_processor(create_tracing_pipeline())
    trace_api.set_tracer_provider(provider)
    tracer = trace_api.get_tracer(name, version)
    return tracer
```

Then use this global variable called tracer in the decorator.

```
@app.route("/")
@tracer.start_as_current_span("index")
def index():
    span = trace_api.get_current_span()
    span.set_attributes(
        {
            SpanAttributes.HTTP_REQUEST_METHOD: request.method,
            SpanAttributes.URL_PATH: request.path,
            SpanAttributes.HTTP_RESPONSE_STATUS_CODE: 200,
        }
    )
    do_stuff()
```
#### Context Propagation

OpenTelemetry provides inject() and extract() methods for propagating context using propagators like W3C Trace Context.

- Inject (Passing Context to an Outgoing Request): Adds trace context to HTTP headers before sending a request. Used when a service calls another service.

- Extract (Receiving Context from an Incoming Request): Extracts trace context from incoming HTTP headers. Ensures the service continues the trace instead of starting a new one.

OpenTelemetry’s data transmission system includes the concept of [propagators](https://opentelemetry.io/docs/specs/otel/context/api-propagators). Propagators serialize context, so it can traverse the network along with the request.

By default, OpenTelemetry uses a specification established by the World Wide Web Consortium (W3C). Looking at the header’s value, we can infer that it encodes the trace context as `<specversion>-<trace_id>-<parent_id>-<traceflag>`.

#### Manual instrumentation Metrics
We do not use meters directly to generate metrics. Instead, meters produce (and are associated with) a set of instruments. An instrument reports measurements, which represent a data point reflecting the state of a metric at a particular point in time. 

You would use a meter to create an instrument, such as a counter, designed to track the number of occurrences of an event. Each time a request is made to the server, the counter instrument records a measurement, which is a single data point indicating that a request has occurred. Over time, these measurements are aggregated into data points, which provide a summary of the metric’s behavior, such as the total number of requests received.

OpenTelemetry provides different types of **instruments** to measure various aspects of your application:
- Counters: monotonically increasing values, such as the total number of requests handled by a server
- UpAndDownCounter: track values that can both increase and decrease, like the number of active connections to a database
- Gauge: reflect the state of a value at a given time, such as the current memory usage of a process
- Histogram: used to analyze the distribution of how frequently a value occurs, which can help identify trends or anomalies in the data

##### Metrics Pipeline
To record the number of requests to a server and send it to the OTel Collector, you would:
- Create a counter instrument using a meter provider.
- Increment the counter for each request.
- Configure a metric exporter to send the data to the OTel Collector.

The metric exporter is responsible for sending collected metric data to an observability backend, such as Prometheus or an OpenTelemetry Collector.

```
"resource": { // <- origin
    "attributes": {
        "telemetry.sdk.language": "python",
        "telemetry.sdk.name": "opentelemetry",
        "telemetry.sdk.version": "1.24.0",
        "service.name": "unknown_service"
    },
},
"scope_metrics": [
    {
        "scope": { // <-- defined by meter
            "name": "app.py",
            "version": "0.1",
            "schema_url": ""
        },
        "metrics": [
            {
                "name": "index_called", // <-- identify instrument
                "description": "Total amount of requests to /",
                "unit": "request",
                "data": {
                    "data_points": [ // <-- reported measurements
                        {
                            "attributes": {},
                            "start_time_unix_nano": 1705676073229533664,
                            "time_unix_nano": 1705676101944590149,
                            "value": 1
                        }
                    ],
                    "aggregation_temporality": 2, // <-- aggregation
                    "is_monotonic": true
                }
            }
        ],
    }
]
```

The instrument reports separate counters for each unique combination of attributes. The number of attributes and the range of values can quickly lead to many unique combinations. High cardinality means we have to keep track of numerous distinct time series, which leads to increased storage requirements, network traffic, and processing overhead. Each unique combination of attributes represents a distinct time series that must be tracked.

Every instrument type has a default method for aggregating a metric based on incoming measurements. For instance, a Counter performs a SumAggregation, while a Gauge defaults to LastValueAggregation.

### The Four Golden Signals of Observability
- Traffic: volume of requests handled by the system
- Errors: rate of failed requests
- Latency: the amount of time it takes to serve a request. Histograms are ideal for this because they represent a frequency distribution across many requests. They allow us to divide a set of data points into percentage-based segments, commonly known as percentiles. For example, the 95th percentile latency (P95) represents the value below which 95% of response times fall.
- Saturation: how much of a resource is being consumed at a given time. “amount of work that a resource is unable to service.” In other words, saturation is a backlog of unprocessed work. An example of a saturation metric would be the length of a queue.

Customize the collection of metrics in OpenTelemetry SDK by configuring exporters, setting the aggregation method, and defining resource attributes.

#### Manual instrumentation Logs
In OpenTelemetry, every piece of data that is neither a part of a distributed trace nor a metric is considered a log. For example, events are just specialized log entries.

Span Attributes: Describe the span itself (e.g., metadata about the operation).
Logs: Capture discrete events or messages that occur during the span's execution.
Example Scenario
Span Attribute: http.method = 'GET' (describes the HTTP request).
Log: "User login failed" (an event that occurred during the request).

OTel exposes a `Logs Bridge API` that combines the **existing logging solution** with traces and metrics collected by OpenTelemetry or other components of OpenTelemetry. This API should be provided by the logging solution. The logging solution should be configured to send log entries, also called `LogRecord` (log entry consisting of multiple fields like timestamp, traceId, spanId, severityText, body, and others), into a `LogRecordExporter`. The logging solution can use the `LoggerProvider factory` to create new `Logger` instances that are initialized once and match the application's lifecycle. The created logger is responsible for creating log entries. When logs are created, `LogRecordExporters` is responsible for sending the log entries to a collector like the OpenTelemetry Collector. 

The data model of OpenTelemetry logging is designed so that existing data models can be mapped to the OpenTelemetry data model.
Since logs provide additional metadata, all the collected telemetry data can be correlated to each other.

The structure of OpenTelemetry logs, with special attention to how `trace` and `span IDs` are included in log entries for better correlation between logs and traces.

### Collector

Binary written in Go, that runs as a separate, standalone process. It provides a flexible, configurable, and vendor-agnostic system to process telemetry outside the application. It is essentially a broker between a telemetry source and the backend storing the data.

The pipeline for a telemetry signal consists of a combination of `receivers`, `processors`, and `exporters`.

A `receiver` is how data gets from a source (i.e. the application) to the OpenTelemetry collector. This mechanism can either be pull- or push-based. Out-of-the-box, the Collector supports an OTLPReceiver for receiving traces, metrics, and logs in OpenTelemetry’s native format. The collector-contrib repository includes a range of receivers to ingest telemetry data encoded in various protocols.
A `processor` provides a mechanism to pre-process telemetry before sending it to a backend. There are two categories of processors, some apply to all signals, while others are specific to a particular type of telemetry
The `exporter` takes the data, converts the internal representation into a protocol of choice, and forwards it to one (or more) destination.

#### Collector topologies
- Sidecar-based deployment, the collector runs as a container next to the application. Having a collection point to offload telemetry as quickly as possible has several advantages. By sharing a pod, the application and collector can communicate via a localhost. This provides a consistent destination for the application to send its telemetry to. Since local communication is fast and reliable, the application won’t be affected by latency that might occur during telemetry transmission. This ensures that the application can spend its resources processing workloads instead of being burdened by the telemetry collection, processing, and transmission.
- Node Agent collector, run a collector agent on every node in the cluster. The collection point for all applications running on a particular node. Similar to sidecars, applications can evacuate the produced telemetry quickly. However, having a single agent per node means that we decrease the number of connections to send telemetry.
- Standalone Service, we no longer compete with applications for available resources. Consider the potential for network latency, which can impact the performance of the telemetry pipeline.
----

To visualize your otel data during local development (can also be used as an exporter to collect and display the traces, metrics, and structured logs generated by your applications), run [.NET Aspire dashboard](https://learn.microsoft.com/en-us/dotnet/aspire/fundamentals/dashboard/overview?tabs=bash):

- 18888: access the [UI](http://localhost:18888)
- 4317: receive telemetry(OTLP protocol)
- `DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS` : disable the login page

`docker run --rm -it -p 18888:18888 -p 4317:18889 -d --name aspire-dashboard -e DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS='true' mcr.microsoft.com/dotnet/aspire-dashboard:9.0`

To run the application:

- -r: load a module before your user code runs
- --env: load .env vars
  `node -r "./instrumentation.js" --env-file=".env" service.js`

Instrumentation

- the Node SDK and autoinstrumentations package

The Node SDK lets you initialize OpenTelemetry with several configuration defaults that are correct for the majority of use cases.
The auto-instrumentations-node package installs instrumentation libraries that will automatically create spans corresponding to code called in libraries.

Notes:

https://grafana.com/docs/loki/latest/reference/loki-http-api/#ingest-logs-using-otlp

Loki natively supports ingesting OpenTelemetry logs over HTTP. For ingesting logs to Loki using the OpenTelemetry Collector, you must use the otlphttp exporter.

Protocol Buffers are a language and platform-neutral mechanism for serializing and deserializing structured data. Google, its creator, proclaims them to be much faster, smaller, and simpler than other types of payloads, such as XML and JSON.

Protobuf uses a .proto file to define the structure of our data. Each file describes the data that might be transferred from one node to another, or stored in data sources. Once the schema is defined, we’ll use the Protobuf compiler (protoc) to generate source code in various languages:

- @opentelemetry/exporter-trace-otlp-proto --> This module provides a trace-exporter for OTLP (http/protobuf)
  - 4318 because its HTTP!!!
  - protobuf is just the enconding!
  - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
  - OTEL_EXPORTER_OTLP_TRACES_PROTOCOL="http"
- @opentelemetry/exporter-trace-otlp-grpc --> This module provides a trace-exporter for OTLP (gRPC)
  - 4317 because its grpc!!!
  - protobuf is just the enconding!
  - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318"
  - OTEL_EXPORTER_OTLP_TRACES_PROTOCOL="grpc"
- @opentelemetry/exporter-trace-otlp-http --> This module provides a trace-exporter for OTLP (http/json)
  - 4318 because its http!!!
  - protobuf is just the enconding!
  - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
  - OTEL_EXPORTER_OTLP_TRACES_PROTOCOL="http"
  - The packages `@opentelemetry/exporter-trace-otlp-proto` and `@opentelemetry/exporter-trace-otlp-http` are both **OpenTelemetry exporters** used to send trace data from a Node.js application to an OpenTelemetry-compatible backend, but they differ in their **transport protocols**:

### 1. **@opentelemetry/exporter-trace-otlp-proto**

- **Protocol**: This exporter uses **gRPC** as the transport protocol.
- **Serialization Format**: It uses **Protocol Buffers (protobuf)** for encoding the trace data.
- **Standard Port**: This typically sends data to the default **gRPC endpoint** (e.g., `localhost:4317`).
- **Usage Scenario**: This exporter is ideal if you want to leverage gRPC features, such as efficient binary encoding, streaming support, and bidirectional communication.

### 2. **@opentelemetry/exporter-trace-otlp-http**

- **Protocol**: This exporter uses **HTTP** (often HTTP/1.1 or HTTP/2) as the transport protocol.
- **Serialization Format**: It also uses **Protocol Buffers (protobuf)** for encoding but sends data over HTTP.
- **Standard Port**: This typically sends data to the default **HTTP endpoint** (e.g., `localhost:4318`).
- **Usage Scenario**: This exporter is beneficial if your environment or infrastructure prefers HTTP over gRPC, or if there are network restrictions on gRPC. HTTP can be more straightforward to configure in environments where gRPC might not be fully supported.

| Feature                | `@opentelemetry/exporter-trace-otlp-proto` | `@opentelemetry/exporter-trace-otlp-http` |
| ---------------------- | ------------------------------------------ | ----------------------------------------- |
| **Transport Protocol** | gRPC                                       | HTTP                                      |
| **Default Port**       | 4317                                       | 4318                                      |
| **Encoding**           | Protobuf                                   | Protobuf                                  |
| **Compatibility**      | Needs gRPC support                         | Compatible with HTTP-only environments    |

Choose **`@opentelemetry/exporter-trace-otlp-proto`** if gRPC is available and preferred for efficiency, and **`@opentelemetry/exporter-trace-otlp-http`** if you need to send data over HTTP, providing more flexibility in terms of network compatibility.
