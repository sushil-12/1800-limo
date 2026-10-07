import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';

declare var google: any;


@Component({
  selector: 'app-live-ride-tracking',
  templateUrl: './live-ride-tracking.component.html',
  styleUrls: ['./live-ride-tracking.component.scss']
})
export class LiveRideTrackingComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  status = 'Connecting...';
  rideData: any = null;
  pathHistory: any[] = [];
  error: string | null = null;
  estimatedTimeToPickup: string | null = null;
  estimatedDistanceToPickup: string | null = null;
  chatOpen = false;
  chatUnread = 0;

  readonly socketUrl = environment.production ? 'https://limortservice.1800limo.com' : 'https://limortservice.infodevbox.com';
  readonly socketSecret = 'limoapi_notifications_secret_2024_xyz789';

  socket: Socket | null = null;
  currentUserId: number | null = null;
  private googleMap: any = null;
  private markers: { driver: any; pickup: any; dropoff: any } = { driver: null, pickup: null, dropoff: null };
  private directionsRenderer: any = null;
  private directionsRendererPickupToDropoff: any = null;
  private historyPolyline: any = null;
  private lastRouteUpdate = 0;
  private routeCalculated = false;
  private pickupToDropoffRouteCalculated = false;
  private currentBookingId: string | number | null = null;
  private currentCustomerId: string | number | null = null;
  private connectionCheckInterval: any = null;
  private readonly SECRET = 'LIMO_LIVE_TRACK_SECRET_2026'; // keep same everywhere
  private readonly TOKEN_LENGTH = 32;

  private attachSocketDebugger(socket: any): void {
    const originalOn = socket.on.bind(socket);
  
    socket.on = (event: string, callback: Function) => {
      return originalOn(event, (...args: any[]) => {
        console.log('[SOCKET EVENT SUSHIL]', event, args);
        callback(...args);
      });
    };
  }

  // ID Decoding Logic
  private readonly PREFIX = "LXSH";
  private readonly SUFFIX = "ZXSL";

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.initializeSocket();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    // Clear connection check interval
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Disconnect socket and remove all listeners
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private initializeMap(): void {
    const defaultCenter = { lat: 40.7128, lng: -74.0060 };

    this.googleMap = new google.maps.Map(this.mapContainer.nativeElement, {
      zoom: 13,
      center: defaultCenter,
      disableDefaultUI: true,
      zoomControl: false,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] }
      ]
    });

    // Route Line (Black) - Driver to destination
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.googleMap,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { strokeColor: '#111827', strokeWeight: 5, strokeOpacity: 0.9 }
    });

    // Route Line (Blue) - Pickup to Dropoff (always visible)
    this.directionsRendererPickupToDropoff = new google.maps.DirectionsRenderer({
      map: this.googleMap,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.7 }
    });

    // History Trail (Gray)
    this.historyPolyline = new google.maps.Polyline({
      map: this.googleMap,
      path: [],
      geodesic: true,
      strokeColor: '#9ca3af',
      strokeOpacity: 0.8,
      strokeWeight: 4
    });
  }

  /**
   * Initialize Socket.IO connection with backend
   * 
   * BACKEND FLOW (MUST MATCH):
   * 1. Client connects with auth: { userId, userType: 'customer', secret }
   * 2. Client MUST emit 'join-room' with { room: customerId } to receive events
   * 3. Backend emits 'active_ride' on connection
   * 4. Client extracts bookingId/customerId from active_ride
   * 5. Client ensures room membership (customerId preferred, bookingId fallback)
   * 6. Backend emits 'driver.location.update' ONLY to joined rooms
   * 7. On reconnect, client MUST rejoin all rooms
   */
  private initializeSocket(): void {
    // Get tracking_id from route parameter (encoded customerId)
    const encodedUserId = this.route.snapshot.paramMap.get('tracking_id');
    const userId = encodedUserId;

    console.log('Initializing socket with tracking_id:', encodedUserId, 'decoded userId:', userId);

    if (!userId) {
      this.error = 'Invalid or Missing Tracking ID';
      console.error('Invalid tracking_id:', encodedUserId);
      return;
    }

    // Store userId for room joining (this is the customerId)
    //@ts-ignore
    this.currentUserId = userId;

    const socketUrl = this.socketUrl;
    console.log('Connecting to socket URL:', socketUrl);

    try {
      // Connect with authentication (backend validates secret & userId)
      this.socket = io(socketUrl, {
        transports: ['polling', 'websocket'],
        auth: { 
          userId: userId, 
          userType: 'customer', 
          secret: this.socketSecret
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      });

      // STEP 1: On socket connect, join customerId room (primary room for receiving events)
      this.socket.on('connect', () => {
        console.log('Socket connected successfully', {
          id: this.socket?.id,
          transport: (this.socket as any)?.io?.engine?.transport?.name
        });
        this.status = 'Connected';
        this.error = null;
        
        // Join customerId room immediately on connect (backend requirement)
        // This ensures we receive driver.location.update events
        this.joinRoom(this.currentUserId?.toString() || null, 'customerId');

        // 'connect' also fires after every automatic reconnect (socket.io v4 emits
        // 'reconnect' on the Manager, not the socket), so rejoin the booking room here too —
        // otherwise location updates and chat messages stop after the first network blip.
        if (this.currentBookingId) {
          this.joinRoom(this.currentBookingId.toString(), 'bookingId');
        }
      });

      this.socket.on('disconnect', (reason: any) => {
        console.log('Socket disconnected:', reason);
        this.status = 'Disconnected';
        if (reason === 'io server disconnect') {
          // Server disconnected the socket, need to reconnect manually
          this.socket?.connect();
        }
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('Socket connection error:', error);
        this.status = 'Connection Error';
        this.error = `Connection failed: ${error.message || 'Unable to connect to server'}`;
      });

      // STEP 2: On reconnect, rejoin all necessary rooms
      this.socket.on('reconnect', (attemptNumber: number) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        this.status = 'Connected';
        this.error = null;
        
        // Rejoin customerId room (always rejoin on reconnect)
        this.joinRoom(this.currentUserId?.toString() || null, 'customerId');
        
        // Rejoin bookingId room if we have an active booking
        if (this.currentBookingId) {
          this.joinRoom(this.currentBookingId.toString(), 'bookingId');
        }
      });

      this.socket.on('reconnect_attempt', (attemptNumber: number) => {
        console.log('Reconnection attempt', attemptNumber);
        this.status = `Reconnecting... (${attemptNumber})`;
      });

      this.socket.on('reconnect_error', (error: any) => {
        console.error('Reconnection error:', error);
        this.status = 'Reconnection Failed';
      });

      this.socket.on('reconnect_failed', () => {
        console.error('Reconnection failed after all attempts');
        this.status = 'Connection Failed';
        this.error = 'Unable to connect to server. Please refresh the page.';
      });

      // STEP 3: Setup event handlers for backend events
      const handleData = (data: any, type: string) => this.processRideData(data, type);

      // STEP 3a: active_ride - Backend sends this on connection to provide ride context
      // After receiving this, we extract bookingId and customerId, then ensure correct room membership
      this.socket.on('active_ride', (d: any) => {
        console.log('Received active_ride event:', d);
        handleData(d, 'active_ride');
        
        // Extract bookingId and customerId from active_ride to ensure room membership
        const rideData = d.data || d;
        const bookingId = rideData.booking_id || rideData.bookingId;
        const customerId = rideData.customer_id || rideData.customerId || 
                          (rideData.customer?.id) || this.currentUserId?.toString();
        
        if (bookingId) {
          this.currentBookingId = bookingId;
          // Join bookingId room as fallback (backend uses bookingId room if customerId unavailable)
          this.joinRoom(bookingId.toString(), 'bookingId');
        }
        
        if (customerId && customerId !== this.currentUserId?.toString()) {
          this.currentCustomerId = customerId;
          // Ensure customerId room is joined (preferred room)
          this.joinRoom(customerId.toString(), 'customerId');
        }
      });

      // STEP 3b: driver.location.update - EXACT backend event name (NOT driver_location_update)
      // Backend emits: io.to(customerId).emit('driver.location.update', payload)
      // Only process if bookingId matches current active ride
      this.socket.on('driver.location.update', (d: any) => {
        // Validate bookingId matches before processing
        const locationBookingId = d.bookingId || d.booking_id;
        if (this.currentBookingId && locationBookingId && 
            locationBookingId.toString() !== this.currentBookingId.toString()) {
          console.log('Ignoring driver.location.update - bookingId mismatch:', {
            received: locationBookingId,
            expected: this.currentBookingId
          });
          return;
        }
        
        console.log('Received driver.location.update event:', d);
        handleData(d, 'driver_loc');
      });

      // STEP 3c: user.notifications - Backend sends ride status updates
      this.socket.on('user.notifications', (d: any) => {
        console.log('Received user.notifications event:', d);
        handleData(d, 'notification');
      });

      // STEP 3d: chat — handled by <app-ride-chat>, which listens for 'chat.message' on this
      // same socket. (A chat payload must not go through processRideData: it would rebuild
      // rideData from the message and blank out the ride panel.)

      // Production-safe connection monitoring (only log warnings, not every status check)
      this.connectionCheckInterval = setInterval(() => {
        if (!this.socket?.connected) {
          console.warn('Socket connection lost - will attempt reconnection');
        }
      }, 10000);
    } catch (error: any) {
      console.error('Error initializing socket:', error);
      this.error = `Failed to initialize connection: ${error.message || 'Unknown error'}`;
      this.status = 'Initialization Error';
    }
  }

  private processRideData(incomingData: any, type: string): void {
    console.log('Processing ride data:', { type, data: incomingData });
    let lat: number, lng: number, bookingId: any;

    // Extract Driver Location from driver.location.update event
    // Backend payload structure: { latitude, longitude, bookingId, customerId, ... }
    if (type === 'driver_loc') {
      lat = parseFloat(incomingData.latitude);
      lng = parseFloat(incomingData.longitude);
      bookingId = incomingData.bookingId || incomingData.booking_id;
      
      // Additional validation: only process if bookingId matches current ride
      if (this.currentBookingId && bookingId && 
          bookingId.toString() !== this.currentBookingId.toString()) {
        console.log('Skipping driver location - bookingId mismatch');
        return;
      }
      
      console.log('Extracted driver location:', { lat, lng, bookingId, rawData: incomingData });
    } else {
      // Extract from active_ride or user.notifications payload
      const d = incomingData.data || incomingData;
      lat = parseFloat(d.driver_latitude || d.driver_lat || d.location?.latitude);
      lng = parseFloat(d.driver_longitude || d.driver_lng || d.location?.longitude);
      bookingId = d.booking_id || d.bookingId;
      
      // Store bookingId and customerId for room management
      if (bookingId && !this.currentBookingId) {
        this.currentBookingId = bookingId;
      }
      const customerId = d.customer_id || d.customerId || (d.customer?.id);
      if (customerId && !this.currentCustomerId) {
        this.currentCustomerId = customerId;
      }
    }

    // Update Path History
    if (!isNaN(lat) && !isNaN(lng)) {
      const last = this.pathHistory[this.pathHistory.length - 1];
      if (!last || Math.abs(last.lat - lat) > 0.0001 || Math.abs(last.lng - lng) > 0.0001) {
        this.pathHistory = [...this.pathHistory, { lat, lng }];
        // Update map after path history changes
        setTimeout(() => this.updateMapVisuals(), 100);
      }
    }

    if (type === 'driver_loc') {
      this.rideData = {
        ...this.rideData,
        driver_lat: lat,
        driver_lng: lng
      };
      // Force route recalculation on driver location update (for ETA updates)
      this.lastRouteUpdate = 0;
      // Update map after driver location changes
      setTimeout(() => this.updateMapVisuals(), 100);
      return;
    }

    let data = incomingData.data || incomingData;
    if (type === 'notification') {
      if (!['live_ride', 'live_ride_do', 'on_location', 'ended'].includes(incomingData.type)) return;
      data = incomingData.data || {};
    }

    const locations = data.locations || {};
    const driver = data.driver || {};
    const vehicle = data.vehicle || driver.vehicle || {};

    this.rideData = {
      booking_id: data.booking_id || data.bookingId,
      status: data.status || incomingData.type || 'In Progress',
      // Keep the last known id: status notifications don't always carry the driver block,
      // and losing it would flip the chat to read-only mid-ride.
      driver_id: driver.id ?? data.driver_id ?? data.driverId ?? this.rideData?.driver_id ?? null,
      driver_name: driver.name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Assigned Driver',
      driver_phone: driver.phone || driver.mobile,
      vehicle_info: vehicle.vehicle_type || vehicle.type || data.vehicle_info || 'Vehicle',
      vehicle_plate: vehicle.plate_number || vehicle.plate || '',
      pickup: {
        address: locations.pickup?.address || data.pickup_address,
        lat: parseFloat(locations.pickup?.latitude || data.pickup_latitude || data.pickup_lat),
        lng: parseFloat(locations.pickup?.longitude || data.pickup_longitude || data.pickup_lng)
      },
      dropoff: {
        address: locations.dropoff?.address || data.dropoff_address,
        lat: parseFloat(locations.dropoff?.latitude || data.dropoff_latitude || data.dropoff_lat),
        lng: parseFloat(locations.dropoff?.longitude || data.dropoff_longitude || data.dropoff_lng)
      },
      driver_lat: lat,
      driver_lng: lng,
      pickup_time: (data.timestamps && data.timestamps.pickup_time) || data.pickup_datetime || data.pickupDateTime
    };

    // Update map visuals after data changes
    setTimeout(() => this.updateMapVisuals(), 100);
  }

  private updateMapVisuals(): void {
    if (!this.rideData || !this.googleMap) return;

    // Car Icon - Using custom car logo image
    const carIcon = {
      url: 'assets/images/car_logo.png',
      scaledSize: new google.maps.Size(48, 48),
      anchor: new google.maps.Point(24, 24),
      optimized: false // Prevent Google Maps from optimizing the image
    };

    const getPin = (color: string) => ({
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`)}`,
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 12)
    });

    // Update Driver Marker (Car Icon) - Always update position if driver location exists
    if (this.rideData.driver_lat && !isNaN(this.rideData.driver_lat) && 
        this.rideData.driver_lng && !isNaN(this.rideData.driver_lng)) {
      const pos = { lat: this.rideData.driver_lat, lng: this.rideData.driver_lng };
      if (!this.markers.driver) {
        this.markers.driver = new google.maps.Marker({
          position: pos,
          map: this.googleMap,
          icon: carIcon,
          zIndex: 100,
          title: 'Driver Location'
        });
      } else {
        this.markers.driver.setPosition(pos);
        this.markers.driver.setVisible(true);
      }
    } else if (this.markers.driver) {
      // Hide driver marker if no location
      this.markers.driver.setVisible(false);
    }

    // Update Pickup Marker - Always create/update if coordinates exist
    if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat) && 
        this.rideData.pickup.lng && !isNaN(this.rideData.pickup.lng)) {
      const pickupPos = { lat: this.rideData.pickup.lat, lng: this.rideData.pickup.lng };
      if (!this.markers.pickup) {
        this.markers.pickup = new google.maps.Marker({
          position: pickupPos,
          map: this.googleMap,
          icon: getPin('#10b981'),
          title: 'Pickup Location',
          zIndex: 50
        });
      } else {
        this.markers.pickup.setPosition(pickupPos);
        this.markers.pickup.setVisible(true);
      }
    } else if (this.markers.pickup) {
      this.markers.pickup.setVisible(false);
    }

    // Update Dropoff Marker - Always create/update if coordinates exist
    if (this.rideData.dropoff && this.rideData.dropoff.lat && !isNaN(this.rideData.dropoff.lat) && 
        this.rideData.dropoff.lng && !isNaN(this.rideData.dropoff.lng)) {
      const dropoffPos = { lat: this.rideData.dropoff.lat, lng: this.rideData.dropoff.lng };
      if (!this.markers.dropoff) {
        this.markers.dropoff = new google.maps.Marker({
          position: dropoffPos,
          map: this.googleMap,
          icon: getPin('#111827'),
          title: 'Dropoff Location',
          zIndex: 50
        });
      } else {
        this.markers.dropoff.setPosition(dropoffPos);
        this.markers.dropoff.setVisible(true);
      }
    } else if (this.markers.dropoff) {
      this.markers.dropoff.setVisible(false);
    }

    // Update Path History
    if (this.historyPolyline) {
      this.historyPolyline.setPath(this.pathHistory);
    }

    // Route Logic - Calculate routes
    const now = Date.now();
    // Update driver route more frequently (every 3 seconds) when driver is moving
    const shouldUpdateDriverRoute = !this.routeCalculated || (now - this.lastRouteUpdate > 3000);
    const directionsService = new google.maps.DirectionsService();
    const hasDriver = this.rideData.driver_lat && !isNaN(this.rideData.driver_lat);

    // ALWAYS show pickup to dropoff route if both locations are available
    // This route is static and only needs to be calculated once when coordinates are available
    if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat) && 
        this.rideData.pickup.lng && !isNaN(this.rideData.pickup.lng) &&
        this.rideData.dropoff && this.rideData.dropoff.lat && !isNaN(this.rideData.dropoff.lat) && 
        this.rideData.dropoff.lng && !isNaN(this.rideData.dropoff.lng)) {
      
      // Calculate pickup-to-dropoff route if not already calculated
      if (!this.pickupToDropoffRouteCalculated && this.directionsRendererPickupToDropoff) {
        directionsService.route({
          origin: this.rideData.pickup,
          destination: this.rideData.dropoff,
          travelMode: google.maps.TravelMode.DRIVING
        }, (response: any, status: any) => {
          if (status === 'OK') {
            this.directionsRendererPickupToDropoff.setDirections(response);
            this.pickupToDropoffRouteCalculated = true;
            console.log('Pickup to dropoff route calculated');
          } else {
            console.error('Failed to calculate pickup-to-dropoff route:', status);
          }
        });
      }
    }

    // Calculate driver route (to pickup or dropoff based on status)
    // This route updates frequently as driver moves
    if (shouldUpdateDriverRoute && hasDriver) {
      let origin = { lat: this.rideData.driver_lat, lng: this.rideData.driver_lng };
      let destination = null;

      // Determine destination based on ride status
      if (this.rideData.status.includes('pu') || this.rideData.status === 'en_route' || 
          this.rideData.status === 'en_route_pu') {
        // Driver heading to pickup
        if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat)) {
          destination = this.rideData.pickup;
        }
      } else if (this.rideData.status === 'on_location') {
        // Driver at pickup, no route needed
        destination = null;
      } else {
        // Driver heading to dropoff
        if (this.rideData.dropoff && this.rideData.dropoff.lat && !isNaN(this.rideData.dropoff.lat)) {
          destination = this.rideData.dropoff;
        }
      }

      if (destination && destination.lat && !isNaN(destination.lat) && 
          destination.lng && !isNaN(destination.lng)) {
        directionsService.route({
          origin: origin,
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING
        }, (response: any, status: any) => {
          if (status === 'OK') {
            const isFirstCalculation = !this.routeCalculated;
            this.directionsRenderer.setDirections(response);
            this.lastRouteUpdate = now;
            this.routeCalculated = true;
            
            // Extract estimated time and distance for pickup route
            if (destination === this.rideData.pickup && response.routes && response.routes[0]) {
              const route = response.routes[0];
              const leg = route.legs[0];
              if (leg) {
                this.estimatedTimeToPickup = leg.duration?.text || null;
                this.estimatedDistanceToPickup = leg.distance?.text || null;
              }
            }
            
            // On first calculation, zoom to the leg the driver is actually on (its full
            // polyline, not just the endpoints) — fitting the whole trip left the active
            // route tiny on longer rides.
            if (isFirstCalculation) {
              const bounds = response.routes[0]?.bounds || new google.maps.LatLngBounds();
              bounds.extend(origin);
              bounds.extend(destination);
              this.fitMapToBounds(bounds);
            }
          } else {
            console.error('Directions request failed:', status);
          }
        });
      }
    } else if (!this.routeCalculated && !hasDriver) {
      // If no driver location, center on pickup/dropoff
      const bounds = new google.maps.LatLngBounds();
      if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat)) {
        bounds.extend(this.rideData.pickup);
      }
      if (this.rideData.dropoff && this.rideData.dropoff.lat && !isNaN(this.rideData.dropoff.lat)) {
        bounds.extend(this.rideData.dropoff);
      }
      if (!bounds.isEmpty()) {
        this.fitMapToBounds(bounds);
      } else if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat)) {
        this.googleMap.setCenter(this.rideData.pickup);
        this.googleMap.setZoom(13);
      }
    }
  }

  handleRecenter(): void {
    if (!this.googleMap || !this.rideData) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Add Driver
    if (this.rideData.driver_lat && !isNaN(this.rideData.driver_lat)) {
      bounds.extend({ lat: this.rideData.driver_lat, lng: this.rideData.driver_lng });
      hasPoints = true;
    }

    // Add Destination Context
    if (this.rideData.status.includes('pu') && this.rideData.pickup.lat) {
      bounds.extend(this.rideData.pickup);
      hasPoints = true;
    } else if (this.rideData.dropoff.lat) {
      bounds.extend(this.rideData.dropoff);
      hasPoints = true;
    }

    if (hasPoints) {
      this.fitMapToBounds(bounds);
    } else if (this.rideData.pickup.lat) {
      this.googleMap.setCenter(this.rideData.pickup);
      this.googleMap.setZoom(15);
    }
  }

  /**
   * Fit the map tightly around `bounds`, padding only the side the info panel covers (left
   * on desktop, the bottom sheet on mobile) so the route sits in the visible part of the map
   * instead of underneath the card. Zoom is capped so two nearby points (driver already at
   * pickup) don't zoom in to street-number level.
   */
  private fitMapToBounds(bounds: any): void {
    if (!this.googleMap || !bounds || bounds.isEmpty()) return;

    const container: HTMLElement | null = this.mapContainer.nativeElement.parentElement;
    const panel = container?.querySelector('.info-panel') as HTMLElement | null;
    const isMobile = window.innerWidth <= 640;
    const edge = 40;
    const padding = { top: edge + 40, right: edge + 40, bottom: edge, left: edge }; // 40 = recenter button

    if (panel) {
      if (isMobile) {
        padding.bottom = Math.min(panel.offsetHeight + edge, window.innerHeight * 0.65);
        padding.top = edge + 20;
      } else {
        // On mid-size windows the panel can be most of the width; padding past half the
        // map makes fitBounds zoom far *out*, the opposite of what we want.
        padding.left = Math.min(panel.offsetLeft + panel.offsetWidth + edge, window.innerWidth * 0.5);
      }
    }

    this.googleMap.fitBounds(bounds, padding);

    const MAX_ZOOM = 16;
    google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
      if (this.googleMap.getZoom() > MAX_ZOOM) this.googleMap.setZoom(MAX_ZOOM);
    });
  }

  getStatusText(status: string): string {
    const map: { [key: string]: string } = {
      'en_route_pu': 'Driver Arriving',
      'on_location': 'Driver Arrived',
      'en_route_do': 'Heading to Destination',
      'ended': 'Trip Completed'
    };
    return map[status] || status || 'In Progress';
  }

  encodeId(id) {
    const SECRET = 'LIMO_LIVE_TRACK_SECRET_2026';
    const ts = Math.floor(Date.now() / 1000);
    const raw = `${id}:${ts}:${SECRET}`;
  
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  
    const hashPart = Math.abs(hash).toString(36);
    const idPart = id.toString(36);
  
    // IMPORTANT: "|" is the separator
    return `${hashPart}|${idPart}`
      .padEnd(32, 'x')
      .slice(0, 32);
  }
  
  decodeId(token) {
    if (!token || token.length !== 32) return null;
  
    const core = token.replace(/x+$/, '');
    const parts = core.split('|');
  
    if (parts.length !== 2) return null;
  
    const userId = parseInt(parts[1], 36);
    return isNaN(userId) ? null : userId;
  }

  /**
   * Join a specific room (matching backend requirements)
   * Backend emits events ONLY to rooms that clients have explicitly joined
   * 
   * @param roomId - The room identifier (customerId preferred, bookingId as fallback)
   * @param roomType - Type of room for logging purposes
   */
  private joinRoom(roomId: string | null, roomType: 'customerId' | 'bookingId'): void {
    if (!this.socket || !this.socket.connected) {
      console.warn(`Cannot join ${roomType} room - socket not connected`);
      return;
    }

    if (!roomId) {
      console.warn(`Cannot join ${roomType} room - room ID is not available`);
      return;
    }

    const roomData = {
      room: roomId
    };

    console.log(`Joining ${roomType} room:`, roomId);
    
    // Emit join-room event (backend requirement)
    // Backend will add this socket to the specified room
    this.socket.emit('join-room', roomData, (response: any) => {
      if (response && response.error) {
        console.error(`Failed to join ${roomType} room:`, response.error);
      } else {
        console.log(`Successfully joined ${roomType} room:`, roomId);
      }
    });
  }
}
