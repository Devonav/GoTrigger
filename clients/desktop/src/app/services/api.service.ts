import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Credential {
  uuid?: string;
  server: string;
  account: string;
  password?: string;
}

export interface SyncManifest {
  zone: string;
  gencount: number;
  digest: string;
  signer_id: string;
}

export interface SyncPullRequest {
  zone: string;
  last_gencount: number;
}

export interface SyncPullResponse {
  gencount: number;
  updates: SyncUpdate[];
}

export interface SyncUpdate {
  uuid: string;
  gencount: number;
  wrappedkey: string;
  encitem: string;
}

export interface TripleLayerPushRequest {
  zone: string;
  keys: CryptoKeyDTO[];
  credential_metadata: CredentialMetadataDTO[];
  sync_records: SyncRecordDTO[];
}

export interface TripleLayerPullResponse {
  keys: CryptoKeyDTO[];
  credential_metadata: CredentialMetadataDTO[];
  sync_records: SyncRecordDTO[];
  gencount: number;
}

export interface CryptoKeyDTO {
  item_uuid: string;
  key_class: number;
  key_type: number;
  label?: string;
  application_label?: string;
  data: string;
  usage_flags: string;
  access_group?: string;
  gencount?: number;
  tombstone?: boolean;
}

export interface CredentialMetadataDTO {
  item_uuid: string;
  server: string;
  account: string;
  protocol: number;
  port: number;
  path?: string;
  label?: string;
  access_group?: string;
  password_key_uuid: string;
  metadata_key_uuid?: string;
  gencount?: number;
  tombstone?: boolean;
}

export interface SyncRecordDTO {
  item_uuid: string;
  parent_key_uuid?: string;
  wrapped_key: string;
  enc_item: string;
  enc_version?: number;
  context_id?: string;
  gencount?: number;
  tombstone?: boolean;
}

export interface TrustedPeer {
  peer_id: string;
  last_seen: string;
  is_current_device: boolean;
  trust_level: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl: string;

  constructor(private http: HttpClient) {
    this.baseUrl = this.getServerUrl();
  }

  private getServerUrl(): string {
    const stored = localStorage.getItem('serverUrl');
    return stored || 'http://localhost:8080';
  }

  setServerUrl(url: string): void {
    this.baseUrl = url;
    localStorage.setItem('serverUrl', url);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  createCredential(credential: Credential): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/credentials`, credential, {
      headers: this.getHeaders()
    });
  }

  getCredential(uuid: string): Observable<Credential> {
    return this.http.get<Credential>(`${this.baseUrl}/api/v1/credentials/${uuid}`);
  }

  getCredentialsByServer(server: string): Observable<Credential[]> {
    return this.http.get<Credential[]>(`${this.baseUrl}/api/v1/credentials/server/${server}`);
  }

  deleteCredential(uuid: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/credentials/${uuid}`);
  }

  getSyncManifest(zone: string = 'default'): Observable<SyncManifest> {
    return this.http.get<SyncManifest>(`${this.baseUrl}/api/v1/sync/manifest?zone=${zone}`);
  }

  pullSync(request: SyncPullRequest): Observable<SyncPullResponse> {
    return this.http.post<SyncPullResponse>(`${this.baseUrl}/api/v1/sync/pull`, request, {
      headers: this.getHeaders()
    });
  }

  pushSync(zone: string, records: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/sync/push`, {
      zone,
      records
    }, {
      headers: this.getHeaders()
    });
  }

  pushTripleLayerSync(request: TripleLayerPushRequest): Observable<{ gencount: number; synced: number }> {
    return this.http.post<{ gencount: number; synced: number }>(
      `${this.baseUrl}/api/v1/sync/push`,
      request,
      { headers: this.getHeaders() }
    );
  }

  pullTripleLayerSync(zone: string, lastGencount: number): Observable<TripleLayerPullResponse> {
    return this.http.post<TripleLayerPullResponse>(
      `${this.baseUrl}/api/v1/sync/pull`,
      { zone, last_gencount: lastGencount },
      { headers: this.getHeaders() }
    );
  }

  listPeers(): Observable<TrustedPeer[]> {
    return this.http.get<TrustedPeer[]>(`${this.baseUrl}/api/v1/peers`);
  }

  establishTrust(peerID: string, publicKey: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/peers/trust`, {
      peer_id: peerID,
      public_key: publicKey
    }, {
      headers: this.getHeaders()
    });
  }

  revokeTrust(peerID: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/peers/${peerID}`);
  }

  healthCheck(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }
}
