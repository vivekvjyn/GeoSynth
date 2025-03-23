import pandas as pd
import numpy as np
from tensorflow.keras.models import load_model
import geocoder
import soundfile as sf

import os
import json

from PyQt5.QtCore import *
from PyQt5.QtWidgets import *
from PyQt5.QtWebEngineWidgets import *
from PyQt5.QtWebChannel import QWebChannel


mlp = load_model('models/mlp.h5')
decoder = load_model('models/decoder.h5')

def get_coordinates(start_country, end_country):
    """
    Fetches the geographical coordinates (latitude and longitude) of two countries 
    and generates a set of 200 evenly spaced latitude and longitude points 
    between the two countries.

    Parameters:
    - start_country: The name of the starting country.
    - end_country: The name of the destination country.

    Returns:
    - lats: A numpy array of 200 latitude points between the start and end countries.
    - longs: A numpy array of 200 longitude points between the start and end countries.
    """
    # Get geolocation data for start and end countries
    g_start = geocoder.arcgis(start_country)
    g_end = geocoder.arcgis(end_country)
    
    # Extract latitude and longitude
    lat_start, long_start = g_start.latlng
    lat_end, long_end = g_end.latlng
    
    # Generate latitude and longitude points between start and end
    lats = np.linspace(lat_start, lat_end, 200)
    longs = np.linspace(long_start, long_end, 200)
    
    return lats, longs

def process_coordinates(lats, longs):
    """
    Processes the latitude and longitude points by normalizing them 
    and converting them into a NumPy array for further prediction.

    Parameters:
    - lats: A list or array of latitude points.
    - longs: A list or array of longitude points.

    Returns:
    - X: A NumPy array where the latitude and longitude are normalized 
      (latitude divided by 90 and longitude divided by 180).
    """
    # Create a DataFrame with Latitude and Longitude
    df = pd.DataFrame({
        'Latitude': lats,
        'Longitude': longs
    })
    
    # Normalize the latitude and longitude by dividing by their max values
    df['Latitude'] = df['Latitude'] / 90.0
    df['Longitude'] = df['Longitude'] / 180.0
    
    # Convert DataFrame to a NumPy array
    X = df.to_numpy()

    return X
    

def predict_latent_and_output(mlp, decoder, X):
    """
    Given the processed input coordinates (X), predicts the latent representation
    using the MLP model, and then decodes that latent representation using the decoder model.
    
    Parameters:
    - mlp: The MLP model used for generating latent representations.
    - decoder: The decoder model used to decode the latent representation.
    - X: The input data (processed coordinates).
    
    Returns:
    - y: The output from the decoder model (after decoding the latent representation).
    """

    # Predict the latent representation using the MLP model
    latent = mlp.predict(X)
    # Use the decoder to get the final output from the latent representation
    y = decoder.predict(latent)
    
    return y

def concatenate_audio(y):
    """
    Given a list of audio data (or arrays), concatenates them into a single array.

    Parameters:
    - y: List or array of audio data arrays (or outputs).

    Returns:
    - y_concat: A single concatenated array containing all audio data.
    """
    # Initialize an empty array to concatenate the audio data
    y_concat = np.array([])

    # Loop through each audio in the list and concatenate
    for audio in y:
        y_concat = np.concatenate([y_concat, audio])
    
    return y_concat

def save_audio_to_file(y_concat, filename='output.wav', rate=44100):
    """
    Saves the concatenated audio data (y_concat) to a .wav file on disk.

    Parameters:
    - y_concat: The concatenated audio data (NumPy array or list).
    - filename: The name of the output .wav file (default is 'output.wav').
    - rate: The sample rate of the audio (default is 44100).
    """
    # Save the audio data to a .wav file using the soundfile library
    sf.write(filename, y_concat, rate)
    print(f"Audio saved as {filename}")


class PythonBridge(QObject):
    """
    Acts as a bridge between JavaScript and Python, enabling message passing.
    """

    @pyqtSlot(str)
    def handleMessage(self, message):
        """
        Handles messages received from JavaScript.
        Parses the incoming JSON message and triggers the appropriate event.
        
        Args:
            message (str): JSON-formatted string containing the event ID and parameters.
        """
        print(f"Message from JavaScript: {message}")
        obj = json.loads(message)

        # Event Dispatcher     
        if obj['id'] == 'Generate':
            window.Generate(obj['country1'], obj['country2'])


class WebViewWindow(QMainWindow):
    """
    Main application window that integrates a QWebEngineView to load and interact 
    with an HTML-based user interface.
    """

    def __init__(self):
        """
        Initializes the web view, loads the HTML file, and sets up the communication 
        bridge between Python and JavaScript.
        """
        super().__init__()

        self.webview = QWebEngineView()
        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "html/main.html"))
        local_url = QUrl.fromLocalFile(file_path)
        self.webview.load(local_url)
        self.setCentralWidget(self.webview)

        # Expose Python object to JavaScript
        self.webview.page().runJavaScript("""
            window.myPythonObject = {
                callPythonFunction: function(data) {
                    // Call Python function from JavaScript
                    pywebview.handleMessage(data);
                }
            };
        """, QWebEngineScript.MainWorld)

        # Create an instance of the PythonBridge
        self.bridge = PythonBridge()

        # Expose the Python object to JavaScript using QWebChannel
        self.channel = QWebChannel()
        self.channel.registerObject('pyBridge', self.bridge)
        self.webview.page().setWebChannel(self.channel)

        self.setMinimumSize(1024, 700)
        self.setGeometry(0, 0, 1024, 700)
        self.setWindowTitle("Music Generation")

    def Generate(self, country1, country2):
        """
        Generates music based on geographical coordinates from two countries.
        The function retrieves coordinates, processes them into model inputs,
        runs a machine learning model to predict audio features, and saves the output.
        
        Args:
            country1 (str): Name of the first country.
            country2 (str): Name of the second country.
        """
        lats, longs = get_coordinates(country1, country2)
        X = process_coordinates(lats, longs)
        y = predict_latent_and_output(mlp, decoder, X)

        y_concat = concatenate_audio(y)
        save_audio_to_file(y_concat, filename='html/output.wav', rate=44100)

        # Notify JavaScript that generation is complete
        command = f"HandleMessage('GenerateOK','','','')"
        self.executeJavaScript(command)

    def executeJavaScript(self, js_code):
        """
        Executes a JavaScript function inside the web view.
        
        Args:
            js_code (str): The JavaScript code to execute.
        """
        self.webview.page().runJavaScript(js_code)


if __name__ == "__main__":
    import sys

    app = QApplication(sys.argv)
    window = WebViewWindow()
    window.show()
    sys.exit(app.exec_())
