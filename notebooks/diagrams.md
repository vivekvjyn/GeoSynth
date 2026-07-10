# GeoSynth — Architecture Diagrams

> Mermaid flowcharts for GitHub rendering. Notebook code cells cannot render mermaid
> directly, so the diagrams live here.

---

## Pipeline

```mermaid
flowchart TD
    DB[(Freesound API)] -->|Fetch & process| A[/Audio/]
    DB -->|Fetch & process| G[/Geotags/]

    subgraph "Training (cGAN)"
      A --> GEN[Generator]
      G --> GEN
      GEN --> FA[/Fake Audio/]
      FA --> DIS[Discriminator]
      A --> DIS
      DIS --> RF[/Real or Fake/]
      RF -.->|Adversarial Loss| GEN
      RF -.->|Adversarial Loss| DIS
    end

    subgraph "Inference"
      HRQ(HTTP Request) --> GEN2[Generator]
      GEN2 --> GA[/Generated Audio/]
      GA --> HRS(HTTP Response)
    end

    style DB fill:#334155,stroke:#1e293b,color:#f8fafc
    style A fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style G fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style GEN fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style FA fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style DIS fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style RF fill:#10b981,stroke:#059669,color:#ecfdf5
    style HRQ fill:#64748b,stroke:#475569,color:#f8fafc
    style GEN2 fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style GA fill:#10b981,stroke:#059669,color:#ecfdf5
    style HRS fill:#64748b,stroke:#475569,color:#f8fafc
```

---

## Training

```mermaid
flowchart TD
    A[/Audio + Geotags/] --> GEN[Generator]
    GEN --> FA[/Fake Audio/]
    FA --> DIS[Discriminator]
    A --> DIS
    DIS --> RF[/Real or Fake/]
    RF -.->|Adversarial Loss| GEN
    RF -.->|Adversarial Loss| DIS

    style A fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style GEN fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style FA fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style DIS fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style RF fill:#10b981,stroke:#059669,color:#ecfdf5
```

---

## Inference

```mermaid
flowchart TD
    HRQ(HTTP Request) --> GEN[Generator]
    GEN --> GA[/Generated Audio/]
    GA --> HRS(HTTP Response)

    style HRQ fill:#64748b,stroke:#475569,color:#f8fafc
    style GEN fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style GA fill:#10b981,stroke:#059669,color:#ecfdf5
    style HRS fill:#64748b,stroke:#475569,color:#f8fafc
```
