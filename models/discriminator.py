from tensorflow.keras import layers, models


class Discriminator(models.Model):
    def __init__(self, dense_units, activations, input_dim, **kwargs):
        super().__init__(**kwargs)
        self.dense_layers = [
            layers.Dense(u, activation=a)
            for u, a in zip(dense_units, activations)
        ]
        self.output_layer = layers.Dense(1, activation='sigmoid')
        self.build(input_shape=(None, input_dim))

    def call(self, x):
        for layer in self.dense_layers:
            x = layer(x)
        return self.output_layer(x)
