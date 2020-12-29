import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Click on the invite link below to get latest updates @ Discord <br></br>
        <a
          className="App-link"
          href="https://discord.gg/cyfAM7M2pN"
          target="_blank"
          rel="noopener noreferrer"
        >
          Invite Link
        </a>
        </p>
      </header>
    </div>
  );
}

export default App;
