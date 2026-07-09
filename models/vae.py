import tensorflow as tf
from tensorflow.keras import layers


CHUNK_SIZE = 2048


class Encoder(layers.Layer):
    def __init__(self, latent_dim=64, **kwargs):
        super().__init__(**kwargs)
        self.conv1 = layers.Conv1D(32, 25, strides=5, activation='relu', padding='same')
        self.conv2 = layers.Conv1D(64, 25, strides=5, activation='relu', padding='same')
        self.flatten = layers.Flatten()
        self.dense1 = layers.Dense(256, activation='relu')
        self.dense2 = layers.Dense(128, activation='relu')
        self.mu = layers.Dense(latent_dim)
        self.logvar = layers.Dense(latent_dim)

    def call(self, x):
        x = tf.expand_dims(x, -1)
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.flatten(x)
        x = self.dense1(x)
        x = self.dense2(x)
        return self.mu(x), self.logvar(x)


class Decoder(layers.Layer):
    def __init__(self, latent_dim=64, **kwargs):
        super().__init__(**kwargs)
        self.dense1 = layers.Dense(256, activation='relu')
        self.bn1 = layers.BatchNormalization()
        self.dense2 = layers.Dense(512, activation='relu')
        self.bn2 = layers.BatchNormalization()
        self.dense3 = layers.Dense(1024, activation='relu')
        self.bn3 = layers.BatchNormalization()
        self.output_proj = layers.Dense(CHUNK_SIZE, activation='tanh')

    def call(self, x, training=False):
        x = self.bn1(self.dense1(x), training=training)
        x = self.bn2(self.dense2(x), training=training)
        x = self.bn3(self.dense3(x), training=training)
        return self.output_proj(x)


class MLP(layers.Layer):
    def __init__(self, latent_dim=64, **kwargs):
        super().__init__(**kwargs)
        self.dense1 = layers.Dense(64, activation='leaky_relu')
        self.dense2 = layers.Dense(128, activation='leaky_relu')
        self.dense3 = layers.Dense(256, activation='leaky_relu')
        self.dense4 = layers.Dense(128, activation='leaky_relu')
        self.dense5 = layers.Dense(latent_dim)

    def call(self, x):
        x = self.dense1(x)
        x = self.dense2(x)
        x = self.dense3(x)
        x = self.dense4(x)
        return self.dense5(x)


class VAE(tf.keras.Model):
    def __init__(self, latent_dim=64, recon_weight=1.0, kl_weight=0.5, mlp_weight=1.0, **kwargs):
        super().__init__(**kwargs)
        self.latent_dim = latent_dim
        self.recon_weight = recon_weight
        self.kl_weight = kl_weight
        self.mlp_weight = mlp_weight
        self.current_kl_weight = tf.Variable(0.0, trainable=False, name='current_kl_weight')

        self.encoder = Encoder(latent_dim)
        self.decoder = Decoder(latent_dim)
        self.mlp = MLP(latent_dim)

        self.recon_loss_tracker = tf.keras.metrics.Mean(name='recon_loss')
        self.kl_loss_tracker = tf.keras.metrics.Mean(name='kl_loss')
        self.mlp_loss_tracker = tf.keras.metrics.Mean(name='mlp_loss')
        self.total_loss_tracker = tf.keras.metrics.Mean(name='total_loss')

    @property
    def metrics(self):
        return [
            self.total_loss_tracker,
            self.recon_loss_tracker,
            self.kl_loss_tracker,
            self.mlp_loss_tracker,
        ]

    def reparameterize(self, mu, logvar):
        eps = tf.random.normal(shape=tf.shape(mu))
        return mu + eps * tf.exp(0.5 * logvar)

    def call(self, inputs):
        audio, geotags = inputs
        mu, logvar = self.encoder(audio)
        z = self.reparameterize(mu, logvar)
        recon = self.decoder(z)
        z_pred = self.mlp(geotags)
        return recon, z, z_pred, mu, logvar

    def compute_loss(self, audio, geotags, training=True):
        mu, logvar = self.encoder(audio, training=training)
        z = self.reparameterize(mu, logvar)
        recon = self.decoder(z, training=training)
        z_pred = self.mlp(geotags, training=training)

        r_loss = tf.reduce_mean(tf.keras.losses.mae(audio, recon))
        kl_loss = tf.reduce_mean(-0.5 * tf.reduce_sum(1 + logvar - tf.square(mu) - tf.exp(logvar), axis=1))
        m_loss = tf.reduce_mean(tf.keras.losses.mse(z_pred, z))

        total = self.recon_weight * r_loss + self.current_kl_weight * kl_loss
        if self.mlp.trainable:
            total = total + self.mlp_weight * m_loss

        return total, r_loss, kl_loss, m_loss

    def train_step(self, data):
        audio, geotags = data
        with tf.GradientTape() as tape:
            total, r_loss, kl_loss, m_loss = self.compute_loss(audio, geotags, training=True)
        grads = tape.gradient(total, self.trainable_variables)
        self.optimizer.apply_gradients(zip(grads, self.trainable_variables))

        self.total_loss_tracker.update_state(total)
        self.recon_loss_tracker.update_state(r_loss)
        self.kl_loss_tracker.update_state(kl_loss)
        self.mlp_loss_tracker.update_state(m_loss)
        return {m.name: m.result() for m in self.metrics}

    def test_step(self, data):
        audio, geotags = data
        total, r_loss, kl_loss, m_loss = self.compute_loss(audio, geotags, training=False)
        self.total_loss_tracker.update_state(total)
        self.recon_loss_tracker.update_state(r_loss)
        self.kl_loss_tracker.update_state(kl_loss)
        self.mlp_loss_tracker.update_state(m_loss)
        return {m.name: m.result() for m in self.metrics}

    def generate(self, geotags):
        z = self.mlp(geotags)
        return self.decoder(z)
