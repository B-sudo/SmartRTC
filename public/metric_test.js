// Assuming you have a video element in your HTML with id "remoteVideo"
const remoteVideo = document.getElementById('user-video-2');

// Variable to store the frame count
let frameCount = 0;

// Variable to store the start time
let startTime;

// Function to update the frame rate display
function updateFrameRate() {
    const currentTime = performance.now();
    const elapsedTime = currentTime - startTime;

    const fps = Math.round((frameCount / elapsedTime) * 1000);

    // Display the calculated frame rate (fps) in the console
    console.log(`Frame Rate: ${fps} fps`);

    // Reset variables for the next interval
    frameCount = 0;
    startTime = currentTime;

    // Schedule the next update after 1000ms (1 second)
    setTimeout(updateFrameRate, 1000);
}

// Function to be called on each frame
function onAnimationFrame() {
    frameCount++;

    // Schedule the next animation frame
    requestAnimationFrame(onAnimationFrame);
}

// Start the frame rate monitoring
updateFrameRate();

// Start the animation frame loop
requestAnimationFrame(onAnimationFrame);

// Add an event listener to the video element to listen for the "loadedmetadata" event
remoteVideo.addEventListener('loadedmetadata', () => {
    // Set the start time when the video metadata is loaded
    startTime = performance.now();
});
