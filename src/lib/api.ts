import { WeddingData, UserProfile, RsvpItem, GuestWish } from '../types/wedding';
import { createDefaultWedding } from './defaultWedding';

const TOKEN_KEY = 'wedding_studio_token';
const USER_KEY = 'wedding_studio_user';

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export class ApiClient {
  private static getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public static setAuth(token: string, user: UserProfile) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Storage error', e);
    }
  }

  public static clearAuth() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('Storage error', e);
    }
  }

  public static getCurrentUser(): UserProfile | null {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  public static getBaseUrl(): string {
    try {
      const custom = (
        (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
        (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
        ''
      ).trim();
      if (custom) return custom.replace(/\/$/, '');
    } catch {}
    return '';
  }

  public static buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const base = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fullUrl = this.buildUrl(endpoint);

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch (networkErr: any) {
      console.error('[API Network Error]', fullUrl, networkErr);
      throw new Error(
        `Koneksi ke server gagal (${networkErr.message || 'Failed to fetch'}). Harap pastikan server aktif dan periksa koneksi internet Anda.`
      );
    }

    if (response.redirected) {
      console.warn('[API Redirected]', fullUrl, '->', response.url);
      throw new Error(
        `Permintaan dialihkan ke "${response.url}". Sesi login Anda mungkin telah kedaluwarsa atau server proxy memerlukan autentikasi browser. Silakan muat ulang halaman dan login kembali.`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      if (text.includes('<!doctype') || text.includes('<html')) {
        throw new Error(
          `Server mengembalikan halaman HTML alih-alih data JSON (Status HTTP ${response.status} ${response.statusText}). Kemungkinan URL API (${fullUrl}) salah atau dialihkan oleh SPA fallback/proxy.`
        );
      }
      throw new Error(
        `Server mengembalikan respons non-JSON (${response.status} ${response.statusText}): ${text.substring(0, 120) || 'format respons tidak sesuai'}`
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error('Gagal menguraikan respons JSON dari server.');
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Permintaan gagal dengan status ${response.status}`);
    }

    return data as T;
  }

  // Auth methods
  static async register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    this.setAuth(res.token, res.user);
    return res;
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setAuth(res.token, res.user);
    return res;
  }

  static async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore if session already expired
    } finally {
      this.clearAuth();
    }
  }

  static async uploadMedia(file: File): Promise<{ id: string; url: string; filename: string; size: number }> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const uploadUrl = this.buildUrl('/api/media/upload');

    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });
    } catch (networkErr: any) {
      console.error('[Upload Network Error]', uploadUrl, networkErr);
      throw new Error(
        `Gagal terhubung ke server upload (${networkErr.message || 'Failed to fetch'}). Harap periksa koneksi internet Anda atau coba beberapa saat lagi.`
      );
    }

    if (response.redirected) {
      console.warn('[Upload Redirected]', uploadUrl, '->', response.url);
      throw new Error(
        `Permintaan upload dialihkan ke "${response.url}". Akses cookie keamanan browser mungkin diblokir atau sesi telah kedaluwarsa. Silakan muat ulang halaman atau login kembali.`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      if (text.includes('<!doctype') || text.includes('<html')) {
        throw new Error(
          `Server upload mengembalikan respons halaman web HTML (Status HTTP ${response.status} ${response.statusText}) alih-alih JSON. Kemungkinan rute API '/api/media/upload' dialihkan oleh proxy/gateway autentikasi atau fallback SPA. URL yang dipanggil: ${uploadUrl}`
        );
      }
      throw new Error(
        `Server upload mengembalikan respons tidak terduga (${response.status} ${response.statusText}): ${text.substring(0, 120) || 'bukan format JSON'}`
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error('Server mengembalikan respons yang rusak atau bukan format JSON yang valid.');
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Gagal mengunggah file gambar (Status HTTP ${response.status}).`);
    }

    const publicUrl = data.url || data.publicUrl || data.file_path || (data.data && data.data.url);
    if (!publicUrl || typeof publicUrl !== 'string' || publicUrl.trim().length === 0) {
      throw new Error('Server berhasil menerima berkas, namun URL publik tidak ditemukan dalam respons.');
    }

    return {
      id: data.id || `med_${Date.now()}`,
      url: publicUrl.trim(),
      filename: data.filename || file.name,
      size: data.size || file.size,
    };
  }

  static async getMe(): Promise<UserProfile> {
    const res = await this.request<{ user: UserProfile }>('/api/auth/me');
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch {}
    return res.user;
  }

  static async updateProfile(fullName?: string, newPassword?: string): Promise<UserProfile> {
    const res = await this.request<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ full_name: fullName, new_password: newPassword }),
    });
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch {}
    return res.user;
  }

  static async requestPasswordReset(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/reset-password-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Weddings methods
  static async getWeddings(): Promise<WeddingData[]> {
    const res = await this.request<{ weddings: WeddingData[] }>('/api/weddings');
    return res.weddings;
  }

  static async createWedding(data?: Partial<WeddingData>): Promise<WeddingData> {
    const user = this.getCurrentUser();
    const defaultData = createDefaultWedding(user?.id || 'demo_user');
    const merged = { ...defaultData, ...data };
    const res = await this.request<{ wedding: WeddingData }>('/api/weddings', {
      method: 'POST',
      body: JSON.stringify(merged),
    });
    return res.wedding;
  }

  static async getWedding(id: string): Promise<WeddingData> {
    const res = await this.request<{ wedding: WeddingData }>(`/api/weddings/${id}`);
    return res.wedding;
  }

  static async updateWedding(id: string, updates: Partial<WeddingData>): Promise<WeddingData> {
    const res = await this.request<{ wedding: WeddingData }>(`/api/weddings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.wedding;
  }

  static async deleteWedding(id: string): Promise<{ message: string; id: string }> {
    return this.request<{ message: string; id: string }>(`/api/weddings/${id}`, {
      method: 'DELETE',
    });
  }

  static async duplicateWedding(id: string): Promise<WeddingData> {
    const res = await this.request<{ wedding: WeddingData }>(`/api/weddings/${id}/duplicate`, {
      method: 'POST',
    });
    return res.wedding;
  }

  // RSVPs for Owner
  static async getWeddingRsvps(weddingId: string): Promise<{
    rsvps: RsvpItem[];
    wishes: GuestWish[];
    stats: {
      totalResponses: number;
      hadir: number;
      tidakHadir: number;
      ragu: number;
      totalGuestsPax: number;
    };
  }> {
    return this.request(`/api/weddings/${weddingId}/rsvps`);
  }

  static async deleteRsvp(weddingId: string, rsvpId: string): Promise<{ message: string }> {
    return this.request(`/api/weddings/${weddingId}/rsvps/${rsvpId}`, {
      method: 'DELETE',
    });
  }

  static async deleteWish(weddingId: string, wishId: string): Promise<{ message: string }> {
    return this.request(`/api/weddings/${weddingId}/wishes/${wishId}`, {
      method: 'DELETE',
    });
  }

  // Public Invitations
  static async getPublicWedding(slug: string): Promise<WeddingData> {
    const res = await this.request<{ wedding: WeddingData }>(`/api/public/weddings/${slug}`);
    return res.wedding;
  }

  static async getPublicWishes(slug: string): Promise<GuestWish[]> {
    const res = await this.request<{ wishes: GuestWish[] }>(`/api/public/weddings/${slug}/wishes`);
    return res.wishes;
  }

  static async submitPublicRsvp(
    slug: string,
    payload: {
      guest_name: string;
      attendance: 'hadir' | 'tidak_hadir' | 'ragu';
      pax_count: number;
      message?: string;
      relationship?: string;
    }
  ): Promise<{ message: string; rsvp: RsvpItem }> {
    return this.request(`/api/public/weddings/${slug}/rsvp`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async submitPublicWish(
    slug: string,
    payload: {
      sender_name: string;
      message: string;
      relationship?: string;
    }
  ): Promise<{ message: string; wish: GuestWish }> {
    return this.request(`/api/public/weddings/${slug}/wishes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
