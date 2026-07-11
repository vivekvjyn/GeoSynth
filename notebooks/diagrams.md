# GeoSynth — Architecture Diagrams

> Mermaid flowcharts for GitHub rendering. Notebook code cells cannot render mermaid
> directly, so the diagrams live here.

---

## Pipeline

```mermaid
flowchart TD
    DB[(Freesound API)] -->|Fetch & process| A[/Audio/]
    DB -->|Fetch & process| G[/Geotags/]

    subgraph "Autoencoder"
      A --> EN[Encoder]
      EN --> LV[/Latent Vector/]
      LV --> DE[Decoder]
      DE --> RA[/Reconstructed Audio/]
      A -.->|MAE Loss| RA
    end

    subgraph "Multi Layer Perceptron"
      G --> MLP[Multi Layer Perceptron]
      MLP --> PLV[/Predicted Latent Vector/]
      PLV --> DE
      LV -.->|MAE Loss| PLV
    end

    HRQ(HTTP Request) --> MLP
    RA --> HRS(HTTP Response)

    style DB fill:#334155,stroke:#1e293b,color:#f8fafc
    style A fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style G fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style EN fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style LV fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style DE fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style RA fill:#10b981,stroke:#059669,color:#ecfdf5
    style MLP fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style PLV fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style HRQ fill:#64748b,stroke:#475569,color:#f8fafc
    style HRS fill:#64748b,stroke:#475569,color:#f8fafc
```

---

## Training

```mermaid
flowchart TD
    A[/Audio/] --> EN[Encoder]
    EN --> LV[/Latent Vector/]
    LV --> DE[Decoder]
    DE --> RA[/Reconstructed Audio/]
    A -.->|MAE Loss| RA

    G[/Geotags/] --> MLP[Multi Layer Perceptron]
    MLP --> PLV[/Predicted Latent Vector/]
    PLV --> DE
    LV -.->|MAE Loss| PLV

    style A fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style EN fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style LV fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style DE fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style RA fill:#10b981,stroke:#059669,color:#ecfdf5
    style G fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style MLP fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style PLV fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
```

---

## Inference

```mermaid
flowchart TD
    HRQ(HTTP Request) --> MLP[Multi Layer Perceptron]
    MLP --> LV[/Latent Vector/]
    LV --> DE[Decoder]
    DE --> GA[/Generated Audio/]
    GA --> HRS(HTTP Response)

    style HRQ fill:#64748b,stroke:#475569,color:#f8fafc
    style MLP fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style LV fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style DE fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style GA fill:#10b981,stroke:#059669,color:#ecfdf5
    style HRS fill:#64748b,stroke:#475569,color:#f8fafc
```
