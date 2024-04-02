document.getElementById('getImageButton').addEventListener('click', async function () {
  const songSearch = document.getElementById('playlistNameId').value;

  const response = await fetch('/getImage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ songSearch: songSearch }),
  });

  const data = await response.json();
  if (data.imageUrl) {
    document.getElementById('imageContainer').innerHTML = '<img src="' + data.imageUrl + '" alt="Generated Image" style="width: 500px; height: 300px; border: 3px solid black;">';
  }
});

document.getElementById('main').addEventListener('submit', function (event) {
  const pname = document.getElementById('playlistNameId').value;
  const errorSpan = document.getElementById('playlistNameError');

  if (pname.trim() === '') {
    errorSpan.textContent = 'Please write the playlist name';
    event.preventDefault();
    errorSpan.style.color = 'red';
  } else {
    errorSpan.textContent = '';
  }
});
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('getSongButton').addEventListener('click', function(event) {
    // Get the values of song title and genre inputs
    var songTitle = document.getElementById('songSearch').value.trim();
    var songGenre = document.getElementById('songGenre').value.trim();

    // Check if the song title is empty
    if (songTitle === '') {
      document.getElementById('songSearchError').innerText = 'Song title cannot be empty';
      return; // Exit the function if validation fails
    } else {
      document.getElementById('songSearchError').innerText = ''; // Clear error message
    }

    // Check if the genre is empty
    if (songGenre === '') {
      document.getElementById('songGenreError').innerText = 'Genre cannot be empty';
      return; // Exit the function if validation fails
    } else {
      document.getElementById('songGenreError').innerText = ''; // Clear error message
    }

    // Call your add song function here
    addSongFunction(songTitle, songGenre);
  });
});

function addSongFunction(title, genre) {
  // Add your logic to handle adding the song here
  alert('Adding song: ' + title + ' Genre: ' + genre);
}