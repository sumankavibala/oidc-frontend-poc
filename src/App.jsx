import React, { useState, useEffect } from 'react';
import { createRemoteJWKSet, jwtVerify } from 'jose';

function App() {
  // Config states (loaded from localStorage or defaults)
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('oidc_server_url') || 'http://localhost:5000');
  const [clientId, setClientId] = useState(() => localStorage.getItem('oidc_client_id') || 'test-client-id');
  const [clientSecret, setClientSecret] = useState(() => localStorage.getItem('oidc_client_secret') || 'test-client-secret');
  const [redirectUri, setRedirectUri] = useState(() => localStorage.getItem('oidc_redirect_uri') || window.location.origin);
  const [scope, setScope] = useState(() => localStorage.getItem('oidc_scope') || 'openid profile');

  // Register user states
  const [regEmail, setRegEmail] = useState('testuser@example.com');
  const [regPassword, setRegPassword] = useState('Password123!');
  const [regRole, setRegRole] = useState('user');

  // Step state
  const [activeStep, setActiveStep] = useState(1);
  const [logs, setLogs] = useState([]);

  // Data states
  const [userToken, setUserToken] = useState(() => localStorage.getItem('oidc_user_token') || '');
  const [authCode, setAuthCode] = useState('');
  
  // Received Tokens
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('oidc_access_token') || '');
  const [idToken, setIdToken] = useState(() => sessionStorage.getItem('oidc_id_token') || '');
  const [refreshToken, setRefreshToken] = useState(() => sessionStorage.getItem('oidc_refresh_token') || '');

  // Verification & Userinfo States
  const [verificationResult, setVerificationResult] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  // Sync config states to localStorage
  useEffect(() => {
    localStorage.setItem('oidc_server_url', serverUrl);
    localStorage.setItem('oidc_client_id', clientId);
    localStorage.setItem('oidc_client_secret', clientSecret);
    localStorage.setItem('oidc_redirect_uri', redirectUri);
    localStorage.setItem('oidc_scope', scope);
  }, [serverUrl, clientId, clientSecret, redirectUri, scope]);

  // Handle OIDC redirect callback on mount
  useEffect(() => {
    console.log('activeStep--->>',activeStep);
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAuthCode(code);
      console.log('code from redirect callback-->>',code);
      setActiveStep(4);
      addLog(`Received authorization code from redirect callback: ${code}`, 'success');
      
      // Clean query params from URL bar
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (accessToken) {
      setActiveStep(5);
    } else if (userToken) {
      setActiveStep(3);
    }
  }, []);

  const addLog = (message, status = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, message, status }, ...prev]);
  };

  // Step 1: Register client and user
  const handleSetup = async () => {
    addLog('Registering client on backend...');
    try {
      const clientRes = await fetch(`${serverUrl}/oauth/addClient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          name: 'React Test App',
          redirectUris: [redirectUri],
        }),
      });
      const clientData = await clientRes.json();
      console.log('clientRes from setup -->', clientRes);
      addLog(`Client Registration Response: ${JSON.stringify(clientData)}`, clientRes.ok ? 'success' : 'error');


      addLog('Registering user on backend...');
      const userRes = await fetch(`${serverUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          role: regRole,
        }),
      });
      const userData = await userRes.json();
      console.log('userData from setup-->>',userData);
      addLog(`User Registration Response: ${JSON.stringify(userData)}`, userRes.ok ? 'success' : 'error');

      if (clientRes.ok && userRes.ok) {
        addLog('Setup completed successfully! Proceeding to Login step.', 'success');
        setActiveStep(2);
      }
    } catch (err) {
      console.log('error inside setup-->>',err);
      addLog(`Setup failed: ${err.message}`, 'error');
    }
  };

  // Step 2: Login user to get userToken
  const handleLogin = async () => {
    try {
      addLog(`Logging in user: ${regEmail}...`);
      const res = await fetch(`${serverUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserToken(data.token);
        localStorage.setItem('oidc_user_token', data.token);
        addLog('Login successful! Saved user JWT token.', 'success');
        setActiveStep(3);
      } else {
        addLog(`Login failed: ${data.message}`, 'error');
      }
    } catch (err) {
      addLog(`Login error: ${err.message}`, 'error');
    }
  };

  // Step 3: Trigger redirect
  const handleAuthorizeRedirect = () => {
    if (!userToken) {
      console.log('error inside authorize redirect-->>',userToken);
      addLog('Error: User token missing. Login first.', 'error');
      return;
    }
    const authUrl = `${serverUrl}/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&token=${encodeURIComponent(userToken)}`;
    console.log('authUrl from authorize redirect-->>',authUrl);
    addLog(`Redirecting to: ${authUrl}`);
    window.location.href = authUrl;
  };

  // Step 4: Exchange code for tokens
  const handleExchangeToken = async () => {
    try {
      addLog('Exchanging authorization code for tokens...');
      const res = await fetch(`${serverUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: authCode,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAccessToken(data.accessToken);
        setIdToken(data.idToken);
        setRefreshToken(data.refreshToken);

        sessionStorage.setItem('oidc_access_token', data.accessToken);
        sessionStorage.setItem('oidc_id_token', data.idToken);
        sessionStorage.setItem('oidc_refresh_token', data.refreshToken);

        addLog('Token exchange successful!', 'success');
        setActiveStep(5);
      } else {
        addLog(`Token exchange failed: ${data.message}`, 'error');
      }
    } catch (err) {
      addLog(`Token exchange error: ${err.message}`, 'error');
    }
  };

  // Step 5: Verify ID Token
  const handleVerifyIdToken = async () => {
    try {
      if (!idToken) {
        addLog('No ID Token to verify.', 'error');
        return;
      }
      addLog('Fetching JWKS & verifying ID Token...');
      const jwksUrl = `${serverUrl}/.well-known/jwks.json`;
      const JWKS = createRemoteJWKSet(new URL(jwksUrl));
      
      const { payload, protectedHeader } = await jwtVerify(idToken, JWKS);
      
      setVerificationResult({
        success: true,
        payload,
        header: protectedHeader
      });
      addLog('ID Token successfully verified using JWKS keys!', 'success');
      setActiveStep(6);
    } catch (err) {
      setVerificationResult({
        success: false,
        error: err.message
      });
      addLog(`ID Token verification failed: ${err.message}`, 'error');
    }
  };

  // Step 6: Call Userinfo endpoint
  const handleFetchUserInfo = async () => {
    try {
      if (!accessToken) {
        addLog('No Access Token found. Exchange code first.', 'error');
        return;
      }
      addLog('Calling /auth/userinfo...');
      const res = await fetch(`${serverUrl}/auth/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setUserInfo(data);
        addLog('Fetched Userinfo successfully!', 'success');
      } else {
        addLog(`Userinfo failed: ${data.message}`, 'error');
      }
    } catch (err) {
      addLog(`Userinfo error: ${err.message}`, 'error');
    }
  };

  const handleReset = () => {
    sessionStorage.clear();
    localStorage.removeItem('oidc_user_token');
    setUserToken('');
    setAccessToken('');
    setIdToken('');
    setRefreshToken('');
    setAuthCode('');
    setVerificationResult(null);
    setUserInfo(null);
    setActiveStep(1);
    addLog('State reset successfully.');
  };

  return (
    <div className="app-container">
      <header>
        <h1>OIDC Sandbox Client</h1>
        <p className="subtitle">Interactive client to test OpenID Connect flows with oidc-poc backend</p>
      </header>

      {/* Progress Tracker */}
      <div className="flow-progress">
        <div className={`flow-step-pill ${activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : ''}`}>
          <span className="step-num">1</span> Setup Setup
        </div>
        <div className={`flow-step-pill ${activeStep === 2 ? 'active' : activeStep > 2 ? 'completed' : ''}`}>
          <span className="step-num">2</span> Login
        </div>
        <div className={`flow-step-pill ${activeStep === 3 ? 'active' : activeStep > 3 ? 'completed' : ''}`}>
          <span className="step-num">3</span> Authorize
        </div>
        <div className={`flow-step-pill ${activeStep === 4 ? 'active' : activeStep > 4 ? 'completed' : ''}`}>
          <span className="step-num">4</span> Exchange
        </div>
        <div className={`flow-step-pill ${activeStep === 5 ? 'active' : activeStep > 5 ? 'completed' : ''}`}>
          <span className="step-num">5</span> Verify ID
        </div>
        <div className={`flow-step-pill ${activeStep === 6 ? 'active' : activeStep >= 6 ? 'completed' : ''}`}>
          <span className="step-num">6</span> Userinfo
        </div>
      </div>

      <div className="main-grid">
        {/* Left Column: Interactive Steps */}
        <div>
          {/* Section 0: Configurations */}
          <div className="glass-card">
            <h2 className="card-title">
              OIDC Client Config <span className="card-title-badge">Settings</span>
            </h2>
            <div className="form-group">
              <label>OIDC Provider URL</label>
              <input type="text" className="form-input" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Client ID</label>
              <input type="text" className="form-input form-input-mono" value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Client Secret</label>
              <input type="text" className="form-input form-input-mono" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Redirect URI (Callback)</label>
              <input type="text" className="form-input form-input-mono" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Scopes</label>
              <input type="text" className="form-input form-input-mono" value={scope} onChange={(e) => setScope(e.target.value)} />
            </div>
            <button className="btn btn-secondary" onClick={handleReset} style={{ marginTop: '10px' }}>
              Reset Flows & Local Cache
            </button>
          </div>

          {/* Step 1 Card: Setup Client & User */}
          <div className={`glass-card step-container ${activeStep === 1 ? 'active-step' : ''}`}>
            <h2 className="card-title">
              Step 1: Register Client & User
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
              Create a test Client and register a User on the OIDC server.
            </p>
            <div className="form-group">
              <label>Email</label>
              <input type="text" className="form-input" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" className="form-input" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-input" value={regRole} onChange={(e) => setRegRole(e.target.value)} style={{ background: '#000' }}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleSetup}>
              Initialize & Register Setup
            </button>
          </div>

          {/* Step 2 Card: Login */}
          <div className={`glass-card step-container ${activeStep === 2 ? 'active-step' : ''}`}>
            <h2 className="card-title">
              Step 2: Authenticate User
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
              Perform login against the OIDC provider's `/auth/login` to retrieve the user's provider JWT.
            </p>
            <button className="btn btn-primary" onClick={handleLogin}>
              Log In as {regEmail}
            </button>
          </div>

          {/* Step 3 Card: Authorize Redirect */}
          <div className={`glass-card step-container ${activeStep === 3 ? 'active-step' : ''}`}>
            <h2 className="card-title">
              Step 3: Redirect through `/authorize`
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
              Redirect the browser to OIDC provider's `/authorize` route. The user token will be passed in the URL to satisfy authentication.
            </p>
            <div className="info-banner">
              <span>🔑 User token is loaded. Ready to redirect.</span>
            </div>
            <button className="btn btn-primary" onClick={handleAuthorizeRedirect}>
              Redirect to Authorize
            </button>
          </div>

          {/* Step 4 Card: Exchange Code */}
          <div className={`glass-card step-container ${activeStep === 4 ? 'active-step' : ''}`}>
            <h2 className="card-title">
              Step 4: Token Exchange
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
              Authorization code received in URL parameters! Perform a POST request to `/auth/token` using the code, client ID, and client secret to get tokens.
            </p>
            <div className="form-group">
              <label>Authorization Code</label>
              <input type="text" className="form-input form-input-mono" value={authCode} readOnly />
            </div>
            <button className="btn btn-primary" onClick={handleExchangeToken}>
              Exchange Code for Tokens
            </button>
          </div>

          {/* Step 5 Card: Verify ID Token */}
          <div className={`glass-card step-container ${activeStep === 5 ? 'active-step' : ''}`}>
            <h2 className="card-title">
              Step 5: Verify ID Token
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
              Verify the `id_token` signature and claims against the OIDC provider's JWKS keys.
            </p>
            <button className="btn btn-primary" onClick={handleVerifyIdToken}>
              Verify ID Token Signature
            </button>
          </div>

          {/* Step 6 Card: Fetch Userinfo */}
          <div className={`glass-card step-container ${activeStep === 6 ? 'active-step' : ''}`}>
            <h2 className="card-title">
              Step 6: Query `/userinfo`
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
              Call the `/auth/userinfo` resource endpoint using the received access token in the authorization header.
            </p>
            <button className="btn btn-success" onClick={handleFetchUserInfo}>
              Get User Info
            </button>
          </div>
        </div>

        {/* Right Column: Console Logs & Outputs */}
        <div>
          {/* Tokens Display */}
          <div className="glass-card">
            <h2 className="card-title">OIDC Tokens Output</h2>
            
            <div className="form-group">
              <label>Access Token</label>
              <div className="response-container" style={{ margin: 0, padding: '10px' }}>
                <pre className="code-block" style={{ fontSize: '0.8rem', maxHeight: '70px' }}>{accessToken || 'None'}</pre>
              </div>
            </div>

            <div className="form-group">
              <label>ID Token</label>
              <div className="response-container" style={{ margin: 0, padding: '10px' }}>
                <pre className="code-block" style={{ fontSize: '0.8rem', maxHeight: '70px' }}>{idToken || 'None'}</pre>
              </div>
            </div>

            <div className="form-group">
              <label>Refresh Token</label>
              <div className="response-container" style={{ margin: 0, padding: '10px' }}>
                <pre className="code-block" style={{ fontSize: '0.8rem', maxHeight: '70px' }}>{refreshToken || 'None'}</pre>
              </div>
            </div>
          </div>

          {/* Verification Results */}
          {verificationResult && (
            <div className="glass-card">
              <h2 className="card-title">
                Verification Result
                <span className={`badge ${verificationResult.success ? 'badge-green' : 'badge-red'}`}>
                  {verificationResult.success ? 'VERIFIED' : 'FAILED'}
                </span>
              </h2>
              {verificationResult.success ? (
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ID Token Header:</p>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#10b981', margin: '5px 0 15px' }}>
                    {JSON.stringify(verificationResult.header, null, 2)}
                  </pre>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ID Token Claims:</p>
                  <div className="claims-grid">
                    {Object.entries(verificationResult.payload).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <div className="claim-key">{k}</div>
                        <div className="claim-val">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--accent-red)' }}>
                  Error verifying token: {verificationResult.error}
                </div>
              )}
            </div>
          )}

          {/* Userinfo Results */}
          {userInfo && (
            <div className="glass-card">
              <h2 className="card-title">Userinfo Response</h2>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8' }}>
                {JSON.stringify(userInfo, null, 2)}
              </pre>
            </div>
          )}

          {/* Execution Log Console */}
          <div className="glass-card">
            <h2 className="card-title">Activity Logs</h2>
            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logs.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No activity yet. Click the setup button to begin.</span>}
              {logs.map((log, index) => (
                <div key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>[{log.time}]</span>
                  <span className={`status-${log.status}`} style={{ fontWeight: '500' }}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
