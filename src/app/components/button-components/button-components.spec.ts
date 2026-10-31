import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ButtonComponents } from './button-components';
import { vi } from 'vitest';

describe('ButtonComponents', () => {
  let component: ButtonComponents;
  let fixture: ComponentFixture<ButtonComponents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponents],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponents);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Test');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the given icon and emits clicks from an action button', () => {
    const clickSpy = vi.fn();
    component.buttonClick.subscribe(clickSpy);
    fixture.componentRef.setInput('iconName', 'edit');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-icon')?.textContent.trim()).toBe('edit');
    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('Test');

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('does not render a label element when the label is empty or whitespace', () => {
    fixture.componentRef.setInput('label', '  ');
    fixture.componentRef.setInput('iconName', 'edit');
    fixture.componentRef.setInput('ariaLabel', 'Eintrag bearbeiten');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button span')).toBeNull();
    expect(fixture.nativeElement.querySelector('button')?.getAttribute('aria-label'))
      .toBe('Eintrag bearbeiten');
  });

  it('renders a router link when a route is supplied', () => {
    fixture.componentRef.setInput('routerLink', '/dashboard');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a')?.textContent).toContain('Test');
  });

  it('does not render a label element for an empty router link label', () => {
    fixture.componentRef.setInput('label', '');
    fixture.componentRef.setInput('routerLink', '/dashboard');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a span')).toBeNull();
  });
});
