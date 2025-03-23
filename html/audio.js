let currentAudio = null; // Holds the current audio object
let currentTime = 0; // Track the current position of the audio
let isPlaying = false; // To track if the audio is playing
let currentCountryCode = ''; // To store the currently playing country code
let seekBar = document.getElementById("audioSeekBar"); // Seek bar element


function newAudio() {
  seekBar = document.getElementById("audioSeekBar"); // Get seek bar element after DOM loads
  if (!seekBar) {
    console.error("Seek bar not found!");
    return;
  }
  
  // Create a new audio object for the new country or reuse the existing one
  currentAudio = new Audio("output.wav?cache_bust=" + Math.random());
  //currentAudio = new Audio("output.wav");

  currentAudio.currentTime = 0; // Start from where it was left off
  currentAudio.play();
  isPlaying = true;
 
  // Show stop and restart buttons, hide the play button
  document.getElementById('stopAudioButton').style.display = 'inline';
  document.getElementById('restartAudioButton').style.display = 'inline';
  document.getElementById('startAudioButton').style.display = 'none';

    // Update seek bar while playing
  currentAudio.ontimeupdate = updateSeekBar;

  // Listen for when the audio ends
  currentAudio.onended = function () {
    isPlaying = false;
    seekBar.value = 0; // Reset seek bar when audio ends

    document.getElementById('stopAudioButton').style.display = 'none';
    document.getElementById('restartAudioButton').style.display = 'none';
    document.getElementById('startAudioButton').style.display = 'inline';
  };

  // Set the max value of the seek bar when metadata loads
  currentAudio.onloadedmetadata = function () {
    seekBar.max = currentAudio.duration;
    seekBar.value = 0; // Reset the seek bar to start

  };

  seekBar.addEventListener("mousedown", function () {
   
    currentAudio.ontimeupdate = null;  // Stop updating while dragging
  });
  
  seekBar.addEventListener("mouseup", function () {
   
    currentAudio.ontimeupdate = updateSeekBar;  // Resume updates
  });
  
  seekBar.addEventListener("change", function () {
    if (currentAudio) {
      currentAudio.currentTime = seekBar.value;
      currentAudio.ontimeupdate = updateSeekBar;
      if (isPlaying) {
        currentAudio.play();  // Resume play after user releases the seek bar
      }
    }
  });

}



function playAudio() {
  
  if (currentAudio) {
    
    if(!isPlaying){
      currentAudio.play();
      isPlaying = true;
       // Show stop and restart buttons, hide the play button
      document.getElementById('stopAudioButton').style.display = 'inline';
      document.getElementById('restartAudioButton').style.display = 'inline';
      document.getElementById('startAudioButton').style.display = 'none';
    }
  
  }
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentTime = currentAudio.currentTime; // Save the current time when paused
    isPlaying = false;
  }

  // Show play button again, hide stop and restart buttons
  document.getElementById('stopAudioButton').style.display = 'none';
  document.getElementById('restartAudioButton').style.display = 'none';
  document.getElementById('startAudioButton').style.display = 'inline';
}

function restartAudio() {
  if (currentAudio) {
    currentAudio.currentTime = 0; // Restart the audio from the beginning
    currentAudio.play();
    isPlaying = true;

    // Show stop and restart buttons, hide the play button
    document.getElementById('stopAudioButton').style.display = 'inline';
    document.getElementById('restartAudioButton').style.display = 'inline';
    document.getElementById('startAudioButton').style.display = 'none';
  }
}

var seekBarState = 0;

// Update seek bar as audio plays
function updateSeekBar() {
  
    if (!seekBar) {
      seekBar = document.getElementById("audioSeekBar");
    }
    if (currentAudio && seekBar && !isNaN(currentAudio.duration)) {
      seekBar.value = currentAudio.currentTime;
    }
  
}
