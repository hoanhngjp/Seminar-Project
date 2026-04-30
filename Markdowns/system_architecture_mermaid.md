# System Architecture — Mermaid Diagrams
## Smart Music Streaming Platform | PRD V5 / Backlog V7

Paste từng block vào https://mermaid.live để preview và export PNG/SVG.

---

## Diagram 1 — System Architecture Overview

```mermaid
flowchart TB
  Client(["Web SPA\n(React)"])

  subgraph GW["API Gateway Layer"]
    AG["API Gateway\nRouting · Rate Limit · Auth Termination\n< 50ms"]
  end

  subgraph CORE["Core Services"]
    direction TB
    AS["Auth Service\nJWT · RBAC · Redis Blacklist"]
    US["User Service\nProfiles · Preferences\nPostgreSQL"]
    MS["Music Service\nMetadata · S3 Upload\nPostgreSQL / MongoDB"]
    SS["Streaming Service\nStateless · Pre-signed URL\nHTTP Range Request"]
    RS["Recommendation Service\nRule Engine · Redis Weights\nRedis"]
    SRS["Search Service\nFuzzy Search\nElasticsearch"]
    NS["Notification Service\nFan-out Alerts\nMongoDB"]
    ANS["Analytics Service\nAppend-only Logs\nInfluxDB"]
    PS["Listening Party Service\nWebSocket · Host Authority\nRedis (ephemeral)"]
  end

  subgraph INFRA["Infrastructure"]
    direction LR
    KF[("Kafka\nMessage Broker\n5 Topics")]
    RD[("Redis Cluster\nCache · Sessions")]
    S3[("S3\nAudio Storage")]
    CDN["CDN\nAudio Delivery"]
    ES[("Elasticsearch\nSearch Index")]
  end

  subgraph DB["Databases — Database per Service"]
    direction LR
    PG1[("PostgreSQL\nUser Service")]
    PG2[("PostgreSQL / MongoDB\nMusic Service")]
    MDB[("MongoDB\nNotification")]
    IDB[("InfluxDB\nAnalytics")]
    RDB[("Redis\nRecommendation")]
  end

  Client -->|"HTTPS REST"| AG
  Client -->|"WebSocket"| PS
  AG -->|"gRPC"| AS
  AS -->|"gRPC"| US
  AG --> MS
  AG --> RS
  AG --> SS
  AG --> SRS
  AG --> NS
  AG --> ANS

  SS --> S3
  SS --> CDN
  MS --> S3

  US --> PG1
  MS --> PG2
  NS --> MDB
  ANS --> IDB
  RS --> RDB
  PS --> RD
  AG --> RD
  AS --> RD

  SS -->|"Song_Played\nSong_Skipped"| KF
  MS -->|"New_Release"| KF
  US -->|"User_Preferences_Updated"| KF
  NS -->|"Notification_Sent"| KF
  KF --> ANS
  KF --> RS
  KF --> NS

  SRS --> ES

  style GW fill:#E6F1FB,stroke:#185FA5,stroke-width:1.5px,color:#0C447C
  style CORE fill:#f8f8f6,stroke:#ccc,stroke-width:1px
  style INFRA fill:#FAEEDA,stroke:#854F0B,stroke-width:1px
  style DB fill:#E1F5EE,stroke:#0F6E56,stroke-width:1px
```

---

## Diagram 2 — Event-Driven Flow (Kafka)

```mermaid
flowchart LR
  subgraph PROD["Producers"]
    SS["Streaming Service"]
    MS["Music Service"]
    US["User Service"]
    NSPROD["Notification Service"]
  end

  subgraph BUS["Kafka Message Broker"]
    direction TB
    T1[["Song_Played\n(v1)\nat-least-once"]]
    T2[["Song_Skipped\n(v1)\nat-least-once"]]
    T3[["New_Release\n(v1)\nat-least-once"]]
    T4[["User_Preferences_Updated\n(v1)\nat-least-once"]]
    T5[["Notification_Sent\n(v1)\nbest-effort"]]
  end

  subgraph CONS["Consumers"]
    ANS["Analytics Service\nAppend-only · Idempotent\nRedis SET dedup"]
    RS["Recommendation Service\nWeight update · Redis\nSkip -weight / Play +weight"]
    NS["Notification Service\nFan-out · MongoDB\nDLQ after 3 retries"]
  end

  subgraph ERR["Error Handling"]
    DLQ[("Dead Letter Queue\nRetain 7 days")]
  end

  SS -->|"play event + duration%"| T1
  SS -->|"skip event + timestamp"| T2
  MS -->|"new song published"| T3
  US -->|"onboarding genres saved"| T4
  NSPROD -->|"notification delivered"| T5

  T1 --> ANS
  T1 --> RS
  T2 --> ANS
  T2 --> RS
  T3 --> NS
  T4 --> RS
  T5 --> ANS

  ANS -->|"retry 3x → DLQ"| DLQ
  NS -->|"retry 3x → DLQ"| DLQ

  style PROD fill:#E6F1FB,stroke:#185FA5,stroke-width:1px
  style BUS fill:#EEEDFE,stroke:#534AB7,stroke-width:1.5px
  style CONS fill:#E1F5EE,stroke:#0F6E56,stroke-width:1px
  style ERR fill:#FCEBEB,stroke:#A32D2D,stroke-width:1px
```

---

## Diagram 3 — Internal Communication Patterns

```mermaid
flowchart TB
  Client(["Web SPA"])
  GW["API Gateway"]

  subgraph GRPC["gRPC — Internal Hot Path (low latency)"]
    direction LR
    AUTH["Auth Service"]
    USER["User Service"]
  end

  subgraph REST_INT["REST — Internal Service-to-Service"]
    direction LR
    MUSIC["Music Service"]
    STREAM["Streaming Service"]
    REC["Recommendation Service"]
  end

  subgraph ASYNC["Kafka — Async Event Bus (decoupled)"]
    KF[("Kafka")]
    ANL["Analytics Service"]
    NS["Notification Service"]
  end

  subgraph WS["WebSocket — Realtime Bidirectional"]
    PARTY["Listening Party Service"]
  end

  Client -->|"HTTPS REST"| GW
  Client -->|"WSS / SignalR"| PARTY

  GW -->|"gRPC ValidateToken"| AUTH
  AUTH -->|"gRPC GetUserProfile"| USER

  GW -->|"REST"| MUSIC
  GW -->|"REST"| STREAM
  GW -->|"REST"| REC

  MUSIC -->|"REST /internal/storage-key"| STREAM
  REC -->|"REST /internal/songs/batch"| MUSIC

  STREAM -->|"Song_Played / Song_Skipped"| KF
  MUSIC -->|"New_Release"| KF
  USER -->|"User_Preferences_Updated"| KF

  KF --> ANL
  KF --> REC
  KF --> NS
  NS -->|"Notification_Sent"| KF

  style GRPC fill:#E1F5EE,stroke:#0F6E56,stroke-width:1.5px
  style REST_INT fill:#E6F1FB,stroke:#185FA5,stroke-width:1px
  style ASYNC fill:#EEEDFE,stroke:#534AB7,stroke-width:1.5px
  style WS fill:#FAEEDA,stroke:#854F0B,stroke-width:1px
```

---

## Diagram 4 — Deployment Architecture (Docker / Kubernetes)

```mermaid
flowchart TB
  Browser(["Browser / Web SPA"])
  CDN_STATIC["CDN\n(Static Assets)"]

  subgraph INTERNET["Internet Layer"]
    CDN_AUDIO["CDN\n(Audio Delivery)"]
  end

  subgraph K8S["Kubernetes Cluster"]
    direction TB

    subgraph GATEWAY_POD["Gateway Pod"]
      AG["API Gateway\n(x2 replicas)"]
    end

    subgraph SERVICE_PODS["Service Pods (Stateless — Horizontal Scalable)"]
      direction LR
      AUTH_P["Auth\n(x2)"]
      USER_P["User\n(x2)"]
      MUSIC_P["Music\n(x2)"]
      STREAM_P["Streaming\n(x3)"]
      REC_P["Recommendation\n(x2)"]
      SEARCH_P["Search\n(x2)"]
      NOTIF_P["Notification\n(x2)"]
      ANL_P["Analytics\n(x2)"]
      PARTY_P["Listening Party\n(x2)"]
    end

    subgraph INFRA_PODS["Infrastructure Pods"]
      direction LR
      KAFKA_P[("Kafka Cluster\n3 brokers")]
      REDIS_P[("Redis Cluster\n3 nodes")]
      ES_P[("Elasticsearch\n3 nodes")]
    end
  end

  subgraph MANAGED["Managed / External Services"]
    direction LR
    S3_M[("S3\nObject Storage")]
    PG_M[("PostgreSQL\nRDS")]
    MDB_M[("MongoDB\nAtlas")]
    IDB_M[("InfluxDB\nCloud")]
  end

  subgraph OBS["Observability Stack"]
    PROM["Prometheus + Grafana\nMetrics Dashboard"]
    LOG["Centralized Logs\n(CorrelationId tracing)"]
  end

  Browser --> CDN_STATIC
  Browser -->|"HTTPS"| AG
  CDN_AUDIO -->|"Pre-signed URL"| STREAM_P

  AG --> AUTH_P & USER_P & MUSIC_P & STREAM_P & REC_P & SEARCH_P & NOTIF_P & ANL_P
  STREAM_P --> CDN_AUDIO
  STREAM_P --> S3_M
  MUSIC_P --> S3_M

  AUTH_P & USER_P --> PG_M
  MUSIC_P --> PG_M
  NOTIF_P --> MDB_M
  ANL_P --> IDB_M
  REC_P --> REDIS_P
  PARTY_P --> REDIS_P
  AG --> REDIS_P
  SEARCH_P --> ES_P

  STREAM_P & MUSIC_P & USER_P --> KAFKA_P
  KAFKA_P --> ANL_P & REC_P & NOTIF_P

  SERVICE_PODS --> PROM
  SERVICE_PODS --> LOG

  style K8S fill:#E6F1FB,stroke:#185FA5,stroke-width:1.5px
  style MANAGED fill:#E1F5EE,stroke:#0F6E56,stroke-width:1px
  style OBS fill:#FAEEDA,stroke:#854F0B,stroke-width:1px
  style INTERNET fill:#EEEDFE,stroke:#534AB7,stroke-width:1px
  style GATEWAY_POD fill:#D6E4F0,stroke:#2E6DA4,stroke-width:1px
```

---

## Ghi chú sử dụng

- **Mermaid Live Editor**: https://mermaid.live — paste code, export PNG/SVG
- **GitHub / GitLab**: wrap trong ` ```mermaid ``` ` trong Markdown file
- **Notion**: dùng block `/code` chọn ngôn ngữ `mermaid`
- **draw.io**: Import > từ Mermaid (File > Import from > Mermaid)
- **VS Code**: Extension "Mermaid Preview" hoặc "Markdown Preview Mermaid Support"

## Thứ tự đặt trong báo cáo

| Diagram | Chương | Vị trí |
|---|---|---|
| Diagram 1 — System Overview | Chương 1 — Tổng quan | Sau phần mô tả đề tài |
| Diagram 3 — Communication Patterns | Chương 2 — Cơ sở lý thuyết | Minh họa microservices patterns |
| Diagram 2 — Kafka Event Flow | Chương 2 — Cơ sở lý thuyết | Minh họa event-driven architecture |
| Diagram 4 — Deployment | Chương 2 — Cơ sở lý thuyết | Minh họa containerization / K8s |
