Use .NET Aspire dashboard

docker run --rm -it -p 18888:18888 -p 4317:18889 -d --name aspire-dashboard mcr.microsoft.com/dotnet/aspire-dashboard:9.0

https://grafana.com/docs/loki/latest/reference/loki-http-api/#ingest-logs-using-otlp

## Loki natively supports ingesting OpenTelemetry logs over HTTP. For ingesting logs to Loki using the OpenTelemetry Collector, you must use the otlphttp exporter.

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

### Key Differences

| Feature                | `@opentelemetry/exporter-trace-otlp-proto` | `@opentelemetry/exporter-trace-otlp-http` |
| ---------------------- | ------------------------------------------ | ----------------------------------------- |
| **Transport Protocol** | gRPC                                       | HTTP                                      |
| **Default Port**       | 4317                                       | 4318                                      |
| **Encoding**           | Protobuf                                   | Protobuf                                  |
| **Compatibility**      | Needs gRPC support                         | Compatible with HTTP-only environments    |

### Summary

Choose **`@opentelemetry/exporter-trace-otlp-proto`** if gRPC is available and preferred for efficiency, and **`@opentelemetry/exporter-trace-otlp-http`** if you need to send data over HTTP, providing more flexibility in terms of network compatibility.
