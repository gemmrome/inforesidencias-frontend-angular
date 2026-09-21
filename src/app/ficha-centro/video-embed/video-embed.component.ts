import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

import { idYoutube } from '../../shared/video/embebible';

/**
 * Fachada click-to-load para vídeos de YouTube (regla de terceros, docs/15): hasta el
 * clic solo se carga la miniatura; el iframe (youtube-nocookie.com) se inyecta al
 * pulsar. Portado de src/components/ficha/VideoEmbed.tsx.
 */
@Component({
  selector: 'ir-video-embed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-embed.component.html',
})
export class VideoEmbedComponent {
  readonly url = input.required<string>();
  readonly titulo = input.required<string>();

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly activo = signal(false);
  protected readonly id = computed(() => idYoutube(this.url()));

  protected readonly miniatura = computed(() => `https://i.ytimg.com/vi/${this.id()}/hqdefault.jpg`);
  protected readonly embed = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${this.id()}?autoplay=1`),
  );
}
