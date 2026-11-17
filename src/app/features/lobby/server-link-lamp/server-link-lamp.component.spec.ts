import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetworkEventHandlerService } from '@axe/features/lobby/network-event-handler.service';
import { ServerLinkLampComponent } from '@axe/features/lobby/server-link-lamp/server-link-lamp.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('ServerLinkLampComponent', () => {
  let fixture: ComponentFixture<ServerLinkLampComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ServerLinkLampComponent], providers: [...TEST_PROVIDERS] });
    fixture = TestBed.createComponent(ServerLinkLampComponent);
  });

  const lamp = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="server-link-lamp"]');

  it('is lit only while the link to the room server is being tried again', () => {
    fixture.detectChanges();
    expect(lamp()).toBeNull();

    TestBed.inject(NetworkEventHandlerService).serverLinkDown.set(true);
    fixture.detectChanges();
    expect(lamp()).not.toBeNull();

    TestBed.inject(NetworkEventHandlerService).serverLinkDown.set(false);
    fixture.detectChanges();
    expect(lamp()).toBeNull();
  });
});
