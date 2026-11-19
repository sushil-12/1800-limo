import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';
import { UploadService } from 'src/app/services/upload.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import Quill from 'quill';
import { attachPlaceAutocompleteElement, clearPlaceAutocompleteDisplay } from 'src/app/utils/google-place-autocomplete';

declare var $: any;

@Component({
  selector: 'app-affiliate-map-pins',
  templateUrl: './affiliate-map-pins.component.html',
  styleUrls: ['./affiliate-map-pins.component.scss']
})
export class AffiliateMapPinsComponent implements OnInit, AfterViewInit, OnDestroy {
  map: google.maps.Map;
  markers: google.maps.Marker[] = []; // Store the markers
  infoWindow: google.maps.InfoWindow;
  vehiclesRes: any;
  vehicles: any;
  selectedVehicleId: string = 'all';

  // Geo search state
  @ViewChild('geoNearInput') geoNearInput!: ElementRef<HTMLInputElement>;
  geoRadiusOptions: number[] = [25, 50, 100, 250];
  geoRadius: number = 50;
  geoPlace: any = null;
  geoMeta: any = null;
  displayedLocationsCount: number = 0;
  rawLocations: any[] = [];

  // Contact modal state
  selectedAffiliate: any = null;
  show: boolean = false;
  sendMessageField: boolean = true; // true = SMS, false = Email
  smsMessage: string = '';
  editorContent: string = '';
  uploadedFile: any[] | null = null;
  fileUrl: any = null;
  fileType: any = null;
  successMessage: string = '';

  @ViewChild('inputmsg') message!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('messageEditor') messageEditor: any;
  private quillMessageInstance: any;

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean']
    ]
  };

  constructor(
    private adminService: AdminService,
    private uploadService: UploadService,
    private spinner: NgxSpinnerService,
    private ngZone: NgZone,
  ) { }

  ngOnInit(): void {
    (window as any).__openAffiliateModal = (format: string) => {
      this.ngZone.run(() => {
        if (this.selectedAffiliate) {
          this.openModal(this.selectedAffiliate, format);
        }
      });
    };

    this.MapController();

    // Load master vehicle
    this.adminService.getOurVehicles().then(result => {
      this.vehiclesRes = result;
      this.vehicles = this.vehiclesRes.data;
      console.log("veh resp", this.vehicles);
    }).catch(err => {
      console.log("err", err);
    });
  }

  ngAfterViewInit(): void {
    this.initGeoAutocomplete();
  }

  private initGeoAutocomplete(retries = 20): void {
    if (typeof google === 'undefined' || !google.maps || !this.geoNearInput?.nativeElement) {
      if (retries > 0) {
        setTimeout(() => this.initGeoAutocomplete(retries - 1), 200);
      }
      return;
    }
    void attachPlaceAutocompleteElement(
      this.geoNearInput.nativeElement,
      {},
      (place) => this.ngZone.run(() => this.onGeoPlaceSelected(place))
    );
  }

  onGeoPlaceSelected(place: google.maps.places.PlaceResult): void {
    const location = place?.geometry?.location;
    if (!location) {
      if (this.geoPlace) {
        this.clearGeoSearch();
      }
      return;
    }

    const types = place.types || [];
    const stateComponent = (place.address_components || []).find((c) =>
      c.types?.includes('administrative_area_level_1')
    );
    const cityTypes = [
      'locality', 'sublocality', 'postal_town', 'postal_code', 'neighborhood',
      'administrative_area_level_2', 'administrative_area_level_3', 'colloquial_area'
    ];
    let type: 'state' | 'city' | 'address' = 'address';
    if (types.includes('administrative_area_level_1')) {
      type = 'state';
    } else if (types.some((t) => cityTypes.includes(t))) {
      type = 'city';
    }

    const viewport = place.geometry?.viewport;
    this.geoPlace = {
      label: place.formatted_address || place.name || '',
      lat: location.lat(),
      lng: location.lng(),
      type,
      state: stateComponent?.short_name || null,
      bounds: viewport
        ? {
          ne_lat: viewport.getNorthEast().lat(),
          ne_lng: viewport.getNorthEast().lng(),
          sw_lat: viewport.getSouthWest().lat(),
          sw_lng: viewport.getSouthWest().lng(),
        }
        : null,
    };

    this.applyPinFilteringAndRender();
  }

  setGeoRadius(radius: number): void {
    this.geoRadius = radius;
    if (this.geoPlace) {
      this.applyPinFilteringAndRender();
    }
  }

  clearGeoSearch(): void {
    this.geoPlace = null;
    this.geoMeta = null;
    if (this.geoNearInput?.nativeElement) {
      clearPlaceAutocompleteDisplay(this.geoNearInput.nativeElement);
    }
    this.applyPinFilteringAndRender();
    if (this.map) {
      this.map.setCenter(new google.maps.LatLng(41.850033, -87.6500523));
      this.map.setZoom(7);
    }
  }

  private calculateDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 3958.8; // Radius of Earth in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  applyPinFilteringAndRender(): void {
    this.clearMarkers();

    const validLocations = (this.rawLocations || []).filter(
      (loc) => loc.latitude != null && loc.longitude != null && !isNaN(Number(loc.latitude)) && !isNaN(Number(loc.longitude))
    );

    if (!this.geoPlace) {
      this.displayedLocationsCount = validLocations.length;
      this.renderMarkers(validLocations);
      return;
    }

    const gLat = this.geoPlace.lat;
    const gLng = this.geoPlace.lng;
    const bounds = this.geoPlace.bounds;

    const inRegionList: any[] = [];
    const nearbyList: any[] = [];
    const allWithDistance: any[] = [];

    validLocations.forEach((loc) => {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      const dist = this.calculateDistanceInMiles(gLat, gLng, lat, lng);
      const isInRegion = bounds
        ? (lat >= bounds.sw_lat && lat <= bounds.ne_lat && lng >= bounds.sw_lng && lng <= bounds.ne_lng)
        : (dist <= this.geoRadius);

      const item = {
        ...loc,
        _distance: dist,
        distance_mi: Math.round(dist * 10) / 10,
        in_region: isInRegion,
        match_source: loc.match_source || null,
        address_distance_mi: loc.address_distance_mi != null ? Math.round(Number(loc.address_distance_mi) * 10) / 10 : Math.round(dist * 10) / 10
      };
      allWithDistance.push(item);

      if (isInRegion) {
        inRegionList.push(item);
      } else if (dist <= this.geoRadius) {
        nearbyList.push(item);
      }
    });

    const inRegionCount = inRegionList.length;
    const nearbyCount = nearbyList.length;

    let displayed: any[] = [];
    if (inRegionCount + nearbyCount > 0) {
      displayed = [...inRegionList, ...nearbyList].sort((a, b) => a._distance - b._distance);
      this.geoMeta = {
        fallback: false,
        radius_mi: this.geoRadius,
        in_region_count: inRegionCount,
        nearby_count: nearbyCount,
      };
    } else {
      allWithDistance.sort((a, b) => a._distance - b._distance);
      displayed = allWithDistance.slice(0, 10);
      this.geoMeta = {
        fallback: true,
        radius_mi: this.geoRadius,
        in_region_count: 0,
        nearby_count: 0,
      };
    }

    this.displayedLocationsCount = displayed.length;
    this.renderMarkers(displayed);

    if (this.map) {
      const mapBounds = new google.maps.LatLngBounds();
      mapBounds.extend(new google.maps.LatLng(gLat, gLng));
      displayed.forEach((loc) => {
        mapBounds.extend(new google.maps.LatLng(Number(loc.latitude), Number(loc.longitude)));
      });
      this.map.fitBounds(mapBounds);

      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        if (this.map.getZoom() > 14) {
          this.map.setZoom(14);
        }
      });
    }
  }

  ngOnDestroy(): void {
    if ((window as any).__openAffiliateModal) {
      delete (window as any).__openAffiliateModal;
    }
  }

  MapController() {
    console.log('Map has been initialised.');

    this.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 7,
      center: new google.maps.LatLng(41.850033, -87.6500523),
      scaleControl: true
    });

    this.infoWindow = new google.maps.InfoWindow();

    this.infoWindow.addListener('closeclick', () => {
      const ch = document.querySelector('.gm-style-iw-ch');
      if (ch) {
        ch.innerHTML = '';
      }
    });

    this.map.addListener('click', () => {
      if (this.infoWindow) {
        this.infoWindow.close();
        const ch = document.querySelector('.gm-style-iw-ch');
        if (ch) {
          ch.innerHTML = '';
        }
      }
    });

    // Fetch coordinates and add markers
    this.loadMarkers('all');
  }

  onVehicleChange(event: any) {
    const selectedValue = event.value; // The selected value (id or "all")
    this.loadMarkers(selectedValue); // Call the loadMarkers method with the selected value
  }

  loadMarkers(selectedValue: string) {
    // Clear existing markers
    this.clearMarkers();
    this.spinner.show();

    this.adminService.mapsPin(selectedValue).subscribe(
      (data: any) => {
        this.spinner.hide();
        console.log("data", data);
        this.rawLocations = Array.isArray(data) ? data : [];
        this.applyPinFilteringAndRender();
      },
      (error) => {
        this.spinner.hide();
        console.error('Error fetching marker data:', error);
      }
    );
  }

  getGeoTagsHtml(loc: any): string {
    let tags = '';

    if (this.geoPlace) {
      if (loc?.in_region) {
        tags += `<span class="geo-tag geo-tag-region" style="display: inline-block; background: #e6f6ea; color: #136c2e; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 600; white-space: nowrap; line-height: 1.4;">In area</span>`;
      }

      if (loc?.distance_mi != null) {
        tags += `<span class="geo-tag" style="display: inline-block; background: #eef1f5; color: #333; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 600; white-space: nowrap; line-height: 1.4;">${loc.distance_mi} mi</span>`;
      }

      if (loc?.match_source === 'badge_city') {
        const title = 'Business address: ' + (loc?.address_distance_mi != null ? loc.address_distance_mi + ' mi away' : 'not saved');
        tags += `<span class="geo-tag geo-tag-source" title="${title}" style="display: inline-block; background: #fff1e3; color: #8a4a0c; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 500; white-space: nowrap; line-height: 1.4;">By badge city</span>`;
      } else if (loc?.match_source === 'address') {
        tags += `<span class="geo-tag geo-tag-source" style="display: inline-block; background: #fff1e3; color: #8a4a0c; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 500; white-space: nowrap; line-height: 1.4;">By address</span>`;
      } else if (loc?.match_source === 'both') {
        tags += `<span class="geo-tag geo-tag-source" style="display: inline-block; background: #fff1e3; color: #8a4a0c; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 500; white-space: nowrap; line-height: 1.4;">Address &amp; badge city</span>`;
      }

      if (!tags) {
        if (loc?.distance_mi != null) {
          tags = `<span class="geo-tag" style="display: inline-block; background: #eef1f5; color: #333; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 600; white-space: nowrap; line-height: 1.4;">${loc.distance_mi} mi</span>`;
        } else {
          tags = `<span class="geo-tag geo-tag-region" style="display: inline-block; background: #e6f6ea; color: #136c2e; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 600; white-space: nowrap; line-height: 1.4;">In area</span>`;
        }
      }
    } else {
      tags = `<span class="geo-tag geo-tag-region" style="display: inline-block; background: #e6f6ea; color: #136c2e; border-radius: 999px; padding: 3px 12px; font-size: 14px; font-weight: 600; white-space: nowrap; line-height: 1.4;">In area</span>`;
    }

    return `
      <div class="geo-row-tags" style="display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 5px;">
        ${tags}
      </div>
    `;
  }

  renderMarkers(locations: any[]): void {
    locations.forEach((location) => {
      if (location.latitude && location.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: Number(location.latitude), lng: Number(location.longitude) },
          map: this.map,
          title: location.affiliate_name,
        });

        marker.addListener('click', () => {
          this.selectedAffiliate = location;
          const tagsHtml = this.getGeoTagsHtml(location);
          const content = `
            <div class="affiliate-pin-dialog" style="padding: 2px 4px 6px 4px; min-width: 250px; text-align: center;">
              <div id="geo-dialog-tags" style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 6px; padding-right: 22px;">
                ${tagsHtml}
              </div>
              <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px;">
                ${location.affiliate_name} (${location.affiliate_type || 'Affiliate'})
              </div>
              <div style="font-size: 13px; color: #444; margin-bottom: 2px;">
                ${location.mobile || ''}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                ${location.vehicles || ''}
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 8px 0 10px 0;">
              <div style="display: flex; justify-content: space-around; align-items: center; gap: 8px;">
                <div id="pin-sms-btn" onclick="window.__openAffiliateModal && window.__openAffiliateModal('Phone')" style="cursor: pointer; display: flex; flex-direction: column; align-items: center;">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 122.88" style="width: 36px; height: 36px;">
                    <g>
                      <path fill="#1A73E8" d="M122.88,61.41C122.88,27.49,95.39,0,61.47,0S0.06,27.49,0.06,61.41s27.49,61.41,61.41,61.41 S122.88,95.32,122.88,61.41L122.88,61.41z"/>
                      <path fill="#185ABC" d="M83.82,87.93H41.97c-5.95,0-11.14-4.49-11.14-10.45v-0.06v3.48c0,5.95,5.19,11.14,11.14,11.14h41.85 c6.01,0,11.14-5.25,11.14-11.14v-3.48C94.96,83.38,89.77,87.93,83.82,87.93L83.82,87.93L83.82,87.93z M30.77,57.93v-4.75 l-7.79-12.85c-0.44-0.7-0.63-1.33-0.57-1.96v5.44c0,0.51,0.19,1.01,0.51,1.58L30.77,57.93L30.77,57.93z"/>
                      <path fill="#FFFFFF" d="M83.82,36.28H25.2c-2.34,0-3.67,2.03-2.09,4.18l7.66,13.29v23.74c0,6.08,4.43,11.14,10.45,11.14h42.54 c6.01,0,11.14-5.13,11.14-11.14V47.48C94.96,41.4,89.83,36.28,83.82,36.28L83.82,36.28z"/>
                      <path fill="#8AB4F8" d="M83.12,53.05H42.67c-1.77,0-3.48-1.08-3.48-2.79c0-1.71,1.71-2.79,3.48-2.79h40.45c1.77,0,3.48,1.08,3.48,2.79 C86.6,51.98,84.9,53.05,83.12,53.05L83.12,53.05L83.12,53.05z M83.12,64.19H42.67c-1.77,0-3.48-1.08-3.48-2.79 c0-1.71,1.71-2.79,3.48-2.79h40.45c1.77,0,3.48,1.08,3.48,2.79C86.6,63.12,84.9,64.19,83.12,64.19L83.12,64.19L83.12,64.19z M71.92,75.4H42.61c-1.77,0-3.48-1.08-3.48-2.79c0-1.71,1.71-2.79,3.48-2.79h29.31c1.77,0,3.48,1.08,3.48,2.79 C75.4,74.32,73.69,75.4,71.92,75.4L71.92,75.4z"/>
                    </g>
                  </svg>
                  <span style="font-size: 11px; font-weight: 600; margin-top: 4px; color: #222;">Send SMS</span>
                </div>
                <a href="tel:${location.mobile || ''}" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; color: inherit;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 122.88" style="width: 36px; height: 36px;">
                    <path fill="#33a867" fill-rule="evenodd" d="M61.44,0A61.46,61.46,0,1,1,18,18,61.21,61.21,0,0,1,61.44,0ZM48.1,56.19A49.35,49.35,0,0,0,55.39,66.4a41.25,41.25,0,0,0,11.55,8.51,1.14,1.14,0,0,0,1,0,4.48,4.48,0,0,0,1.39-1A16.91,16.91,0,0,0,70.6,72.4c1.85-2.44,4.15-5.47,7.39-4l.2.11L89,74.77l.11.07a4.84,4.84,0,0,1,2,4.2,11.43,11.43,0,0,1-1.58,5.37,11.06,11.06,0,0,1-5.2,4.6A23.63,23.63,0,0,1,78,90.75a21.69,21.69,0,0,1-9.8-.82,43.06,43.06,0,0,1-9.85-4.76L58.05,85c-1.6-1-3.33-2.07-5-3.33a62.69,62.69,0,0,1-16.65-18.9c-3.46-6.26-5.34-13-4.32-19.44a14,14,0,0,1,4.72-8.85A12.68,12.68,0,0,1,46.18,32a1.35,1.35,0,0,1,1.09.7L54.21,44.4a3.68,3.68,0,0,1,.59,3.92,7.71,7.71,0,0,1-2.66,3c-.37.32-.82.64-1.29,1-1.55,1.12-3.32,2.42-2.71,4l0-.05Z" />
                  </svg>
                  <span style="font-size: 11px; font-weight: 600; margin-top: 4px; color: #222;">Make Call</span>
                </a>
                <div id="pin-email-btn" onclick="window.__openAffiliateModal && window.__openAffiliateModal('Email')" style="cursor: pointer; display: flex; flex-direction: column; align-items: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="width: 36px; height: 36px;">
                    <path d="M34,42H14c-4.411,0-8-3.589-8-8V14c0-4.411,3.589-8,8-8h20c4.411,0,8,3.589,8,8v20 C42,38.411,38.411,42,34,42z" fill="#f3933d"/>
                    <path fill="#f9f9f9" d="M35.926,17.488L29.414,24l6.511,6.511C35.969,30.347,36,30.178,36,30V18 C36,17.822,35.969,17.653,35.926,17.488z M26.688,23.899l7.824-7.825C34.347,16.031,34.178,16,34,16H14 c-0.178,0-0.347,0.031-0.512,0.074l7.824,7.825C22.795,25.38,25.205,25.38,26.688,23.899z M12.074,17.488 C12.031,17.653,12,17.822,12,18v12c0,0.178,0.031,0.347,0.074,0.512L18.586,24L12.074,17.488z M24,27.009 c-1.44,0-2.873-0.542-3.99-1.605l-6.522,6.522C13.653,31.969,13.822,32,14,32h20c0.178,0,0.347-0.031,0.512-0.074l-6.522-6.522 C26.873,26.467,25.44,27.009,24,27.009z" />
                  </svg>
                  <span style="font-size: 11px; font-weight: 600; margin-top: 4px; color: #222;">Send E-Mail</span>
                </div>
              </div>
            </div>
          `;
          this.infoWindow.setContent(content);
          this.infoWindow.open(this.map, marker);

          const syncHeaderTags = () => {
            const ch = document.querySelector('.gm-style-iw-ch');
            const dialogTags = document.getElementById('geo-dialog-tags');
            if (ch && dialogTags) {
              ch.innerHTML = `<div style="display: flex; justify-content: flex-end; align-items: center; padding-right: 6px;">${tagsHtml}</div>`;
              dialogTags.style.display = 'none';
            }
          };

          setTimeout(syncHeaderTags, 0);
          setTimeout(syncHeaderTags, 50);

          google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
            syncHeaderTags();
            const smsEl = document.getElementById('pin-sms-btn');
            if (smsEl) {
              smsEl.addEventListener('click', () => {
                this.ngZone.run(() => {
                  this.openModal(location, 'Phone');
                });
              });
            }
            const emailEl = document.getElementById('pin-email-btn');
            if (emailEl) {
              emailEl.addEventListener('click', () => {
                this.ngZone.run(() => {
                  this.openModal(location, 'Email');
                });
              });
            }
          });
        });

        this.markers.push(marker); // Add marker to the array
      } else {
        console.warn('Invalid location data:', location);
      }
    });
  }

  openModal(affiliate: any, format: string = 'Phone') {
    this.selectedAffiliate = affiliate;
    this.messageField(format);
    $('#sendEmailModal').modal('show');
  }

  messageField(format: string) {
    this.show = true;
    this.sendMessageField = format === 'Phone';

    setTimeout(() => {
      const defaultMsg = 'Hi, Please check your email for new bookings. Click Accept/Reject. Thanks, Text Joe at 7082056607 with any questions.';
      if (this.sendMessageField) {
        this.smsMessage = defaultMsg;
        if (this.message?.nativeElement) {
          this.message.nativeElement.value = defaultMsg;
          this.message.nativeElement.focus();
        }
      } else {
        this.editorContent = defaultMsg;
        const quillEditor = document.querySelector('.ql-editor') as HTMLElement;
        if (quillEditor) quillEditor.focus();
      }
    }, 50);
  }

  onMessageEditorCreated(quill: any) {
    this.quillMessageInstance = quill;

    const selectAllText = () => {
      setTimeout(() => {
        const textLength = quill.getText().trim().length;
        if (textLength > 0) {
          quill.setSelection(0, quill.getLength());
        }
      }, 10);
    };

    quill.root.addEventListener('focus', selectAllText);
  }

  myUploader(event: any) {
    this.uploadedFile = Array.from(event.target.files);
    console.log('file', this.uploadedFile);
  }

  getEditorContent(): string {
    if (this.sendMessageField) {
      return this.message?.nativeElement?.value || this.smsMessage || '';
    } else {
      return this.editorContent;
    }
  }

  async submit(message: string, format: boolean) {
    this.spinner.show();
    const sendInformation = format
      ? (this.selectedAffiliate?.mobile || this.selectedAffiliate?.phone || '')
      : (this.selectedAffiliate?.email || this.selectedAffiliate?.dispatch_email || this.selectedAffiliate?.dispatchEmail || this.selectedAffiliate?.affiliate_email || '');
    const reciptentName = this.selectedAffiliate?.affiliate_name || '';

    let fileData: any[] = [];
    if (this.uploadedFile && this.uploadedFile.length) {
      for (let file of this.uploadedFile) {
        let dataS = await this.uploadService.uploadFile(file);
        fileData.push({
          fileUrl: dataS.Location,
          fileType: file.type
        });
      }
    }

    let obj = {
      bookingId: this.selectedAffiliate?.booking_id || null,
      reciptentName: reciptentName,
      sendTo: 'Affiliate',
      sendThrough: format ? 'Phone' : 'Email',
      sendValue: sendInformation,
      sendContent: message,
      fileData: fileData
    };

    this.adminService
      .adminNotification(obj)
      .pipe(
        catchError((err) => {
          this.spinner.hide();
          return throwError(err);
        })
      )
      .subscribe({
        next: (res: any) => {
          this.spinner.hide();
          this.successMessage = res?.message || 'Message sent successfully';
          $('#sendEmailModal').modal('hide');
          $('#successModal').modal('show');
          setTimeout(() => {
            $('#successModal').modal('hide');
          }, 2000);
          this.closeModal();
        },
        error: (err: any) => {
          this.spinner.hide();
          console.error('Error sending message:', err);
        }
      });
  }

  closeModal() {
    $('#sendEmailModal').modal('hide');
    if (this.message?.nativeElement) {
      this.message.nativeElement.value = '';
    }
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    this.smsMessage = '';
    this.uploadedFile = null;
    this.fileType = null;
    this.editorContent = '';
    this.fileUrl = null;
    this.show = false;
  }

  clearMarkers() {
    if (this.infoWindow) {
      this.infoWindow.close();
    }
    // Set each marker's map to null to remove it from the map
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = []; // Reset the markers array
  }
}

