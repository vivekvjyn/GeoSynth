# GeoSynth

![Screenshot](screenshot.png)

Sonification of geolocations using a Conditional GAN with data collected using [Freesound API](https://freesound.org/apiv2/apply). 

- Visit [GeoSynth](https://geosynth.vivekvjyn.xyz/)
- Click on countries on the globe to create a route
- Playhead moves along the route and feeds the co-ordinates to nueral network and produces sound.


## Pipeline

```mermaid
flowchart TD
    DB[(Freesound API)] -->|Fetch & process| A[/Audio/]
    DB -->|Fetch & process| G[/Geotags/]

    subgraph "Generator"
      N[/Noise/] --> GEN[Generator]
      G --> GEN
      GEN --> FA[/Reconstructed Audio/]
    end

    subgraph "Discriminator"
      FA --> DIS[Discriminator]
      A --> DIS
      DIS --> RF[/Real or Fake/]
      RF -.- |Adversarial Loss| GEN
      RF -.- |Adversarial Loss| DIS
    end

    style DB fill:#334155,stroke:#1e293b,color:#f8fafc
    style A fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style G fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style GEN fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style FA fill:#0ea5e9,stroke:#0284c7,color:#f0f9ff
    style DIS fill:#8b5cf6,stroke:#7c3aed,color:#f5f3ff
    style RF fill:#10b981,stroke:#059669,color:#ecfdf5
```

## Run locally

**Clone repository**
```bash
git clone https://github.com/vivekvjyn/GeoSynth.git
git cd GeoSynth
```

**Setup**
```bash
conda create -n geosynth python=3.10 && conda activate geosynth
pip install -r requirements.txt
python flask run
```

## License
This project is licensed under the GNU General Public License. See the [LICENSE](LICENSE) for details.
