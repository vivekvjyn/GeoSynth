from tensorflow.keras import layers, models


class Generator(models.Model):
    def __init__(self, dense_units, activations, input_dim, latent_dim, output_dim, **kwargs):
        super().__init__(**kwargs)
        self.blocks = []
        for u, a in zip(dense_units, activations):
            self.blocks.append(layers.Dense(u))
            self.blocks.append(layers.BatchNormalization())
            self.blocks.append(layers.LeakyReLU(0.2) if a == 'leaky_relu' else layers.Activation(a))
        self.output_layer = layers.Dense(output_dim, activation='tanh')
        self.build(input_shape=(None, input_dim + latent_dim))

    def call(self, x):
        for block in self.blocks:
            x = block(x)
        return self.output_layer(x)
