// Layout templates: for each photo count (1-6), one or more "variants" -
// lists of fractional rects {x,y,w,h} (0..1 of the canvas) describing an
// asymmetric, magazine style composition rather than a plain uniform grid.
// The same rects are used both to render the DOM frames and to place images
// in the PPTX export, so the exported file matches the on-screen layout.
//
// These rects were extracted directly from the user-provided PowerPoint
// template (フォトアルバムテンプレート用.pptx, 30 slides / slideLayouts,
// one duplicate removed) by reading each placeholder's <a:off>/<a:ext> in
// its slideLayout XML and dividing by the 21cm x 21cm slide size - so they
// match the original templates exactly rather than being estimated from a
// screenshot.
//
// A count can offer multiple variants; the page stores which variant index
// it's using so different pages can pick different compositions for the
// same photo count.
(function () {
  const LAYOUT_VARIANTS = {
    1: [
      [{ x: 0.0237, y: 0.0332, w: 0.9525, h: 0.7144 }],
      [{ x: 0, y: 0, w: 1, h: 1 }],
      [{ x: 0.119, y: 0.2619, w: 0.7619, h: 0.4763 }],
      [{ x: 0.2143, y: 0.0667, w: 0.5714, h: 0.8667 }],
      [{ x: 0.1191, y: 0.2143, w: 0.7619, h: 0.5715 }],
      [{ x: 0.1191, y: 0.119, w: 0.7619, h: 0.7619 }],
      [{ x: 0.0237, y: 0.1428, w: 0.9525, h: 0.7144 }],
    ],
    2: [
      [
        { x: 0.2857, y: 0.0667, w: 0.4286, h: 0.4238 },
        { x: 0.2857, y: 0.5095, w: 0.4286, h: 0.4238 },
      ],
      [
        { x: 0.2143, y: 0.0667, w: 0.5715, h: 0.4238 },
        { x: 0.2143, y: 0.5095, w: 0.5715, h: 0.4238 },
      ],
      [
        { x: 0.5095, y: 0.2142, w: 0.4238, h: 0.5716 },
        { x: 0.0667, y: 0.2142, w: 0.4238, h: 0.5716 },
      ],
      [
        { x: 0.119, y: 0.0667, w: 0.7619, h: 0.4238 },
        { x: 0.1206, y: 0.5095, w: 0.7619, h: 0.4238 },
      ],
      [
        { x: 0.0667, y: 0.0667, w: 0.5715, h: 0.4238 },
        { x: 0.3619, y: 0.5095, w: 0.5715, h: 0.4238 },
      ],
      [
        { x: 0.2881, y: 0.0667, w: 0.4238, h: 0.5715 },
        { x: 0.2881, y: 0.6572, w: 0.4238, h: 0.2762 },
      ],
      // 縦長2枚を左右に並べて、高さをずらす(横長2枚のずらし配置の縦バージョン)。
      // 左が上・右が下。
      [
        { x: 0.0667, y: 0.0667, w: 0.4238, h: 0.5715 },
        { x: 0.5095, y: 0.3619, w: 0.4238, h: 0.5715 },
      ],
      // 左が下・右が上(上のミラー)。
      [
        { x: 0.0667, y: 0.3619, w: 0.4238, h: 0.5715 },
        { x: 0.5095, y: 0.0667, w: 0.4238, h: 0.5715 },
      ],
    ],
    3: [
      [
        { x: 0.2868, y: 0.0667, w: 0.4286, h: 0.2762 },
        { x: 0.2857, y: 0.3619, w: 0.4286, h: 0.2762 },
        { x: 0.2868, y: 0.6571, w: 0.4286, h: 0.2762 },
      ],
      [
        { x: 0.2143, y: 0.0667, w: 0.5715, h: 0.2762 },
        { x: 0.2143, y: 0.3619, w: 0.5715, h: 0.2762 },
        { x: 0.2143, y: 0.6571, w: 0.5715, h: 0.2762 },
      ],
      [
        { x: 0.119, y: 0.0667, w: 0.7619, h: 0.2762 },
        { x: 0.119, y: 0.3619, w: 0.7619, h: 0.2762 },
        { x: 0.119, y: 0.6571, w: 0.7619, h: 0.2762 },
      ],
      [
        { x: 0.0667, y: 0.1191, w: 0.2667, h: 0.4121 },
        { x: 0.3524, y: 0.1191, w: 0.5809, h: 0.7619 },
        { x: 0.0667, y: 0.5502, w: 0.2667, h: 0.1827 },
      ],
      [
        { x: 0.0666, y: 0.0667, w: 0.8667, h: 0.5715 },
        { x: 0.0666, y: 0.6572, w: 0.4238, h: 0.2762 },
        { x: 0.5095, y: 0.6572, w: 0.4238, h: 0.2762 },
      ],
      [
        { x: 0.0666, y: 0.3619, w: 0.8667, h: 0.5715 },
        { x: 0.0666, y: 0.0667, w: 0.4238, h: 0.2762 },
        { x: 0.5095, y: 0.0667, w: 0.4238, h: 0.2762 },
      ],
      [
        { x: 0.0667, y: 0.0667, w: 0.2667, h: 0.4238 },
        { x: 0.3524, y: 0.0667, w: 0.5809, h: 0.8667 },
        { x: 0.0667, y: 0.5095, w: 0.2667, h: 0.4238 },
      ],
      // 縦長の大きな1枚が左、小さな2枚が右(上の左右反対)
      [
        { x: 0.6666, y: 0.0667, w: 0.2667, h: 0.4238 },
        { x: 0.0667, y: 0.0667, w: 0.5809, h: 0.8667 },
        { x: 0.6666, y: 0.5095, w: 0.2667, h: 0.4238 },
      ],
      // 縦長の大きな1枚が右、小さな2枚が左(上のv3の左右反対)
      [
        { x: 0.6666, y: 0.1191, w: 0.2667, h: 0.4121 },
        { x: 0.0667, y: 0.1191, w: 0.5809, h: 0.7619 },
        { x: 0.6666, y: 0.5502, w: 0.2667, h: 0.1827 },
      ],
      // ---- 追加: 横に3つ並べる(縦に3つ並べる3種類を90度回転したもの。左から右の順) ----
      // 縦に3つ(細め)の回転版
      [
        { x: 0.0667, y: 0.2857, w: 0.2762, h: 0.4286 },
        { x: 0.3619, y: 0.2857, w: 0.2762, h: 0.4286 },
        { x: 0.6571, y: 0.2857, w: 0.2762, h: 0.4286 },
      ],
      // 縦に3つ(中)の回転版
      [
        { x: 0.0667, y: 0.2143, w: 0.2762, h: 0.5715 },
        { x: 0.3619, y: 0.2143, w: 0.2762, h: 0.5715 },
        { x: 0.6571, y: 0.2143, w: 0.2762, h: 0.5715 },
      ],
      // 縦に3つ(太め)の回転版
      [
        { x: 0.0667, y: 0.119, w: 0.2762, h: 0.7619 },
        { x: 0.3619, y: 0.119, w: 0.2762, h: 0.7619 },
        { x: 0.6571, y: 0.119, w: 0.2762, h: 0.7619 },
      ],
    ],
    4: [
      [
        { x: 0.0667, y: 0.0667, w: 0.2667, h: 0.4238 },
        { x: 0.3524, y: 0.0667, w: 0.5809, h: 0.4238 },
        { x: 0.6667, y: 0.5095, w: 0.2667, h: 0.4238 },
        { x: 0.0667, y: 0.5095, w: 0.5809, h: 0.4238 },
      ],
      [
        { x: 0.6667, y: 0.0667, w: 0.2667, h: 0.4238 },
        { x: 0.0667, y: 0.0667, w: 0.5809, h: 0.4238 },
        { x: 0.0667, y: 0.5095, w: 0.2667, h: 0.4238 },
        { x: 0.3524, y: 0.5095, w: 0.5809, h: 0.4238 },
      ],
      [
        { x: 0.6667, y: 0.0667, w: 0.2667, h: 0.4238 },
        { x: 0.0667, y: 0.0667, w: 0.5809, h: 0.4238 },
        { x: 0.0667, y: 0.5095, w: 0.4238, h: 0.4238 },
        { x: 0.5095, y: 0.5095, w: 0.4238, h: 0.4238 },
      ],
      [
        { x: 0.5095, y: 0.2142, w: 0.4238, h: 0.2762 },
        { x: 0.0667, y: 0.2142, w: 0.4238, h: 0.2762 },
        { x: 0.5095, y: 0.5096, w: 0.4238, h: 0.2762 },
        { x: 0.0667, y: 0.5096, w: 0.4238, h: 0.2762 },
      ],
      [
        { x: 0.0667, y: 0.0667, w: 0.4238, h: 0.4238 },
        { x: 0.5095, y: 0.0667, w: 0.4238, h: 0.4238 },
        { x: 0.0687, y: 0.5095, w: 0.4238, h: 0.4238 },
        { x: 0.5095, y: 0.5095, w: 0.4238, h: 0.4238 },
      ],
      [
        { x: 0.1238, y: 0.0667, w: 0.3095, h: 0.4238 },
        { x: 0.1238, y: 0.5095, w: 0.3095, h: 0.4238 },
        { x: 0.4524, y: 0.3619, w: 0.4238, h: 0.5715 },
        { x: 0.4524, y: 0.0667, w: 0.4238, h: 0.2762 },
      ],
      // ---- 追加: 4枚。縦長の写真が大きい配置 ----
      // 1番目(小+大/大+小の2段)を90度回転したもの。左の列は上が縦長の大、
      // 下が小。右の列は上が小、下が縦長の大。
      [
        { x: 0.5095, y: 0.0667, w: 0.4238, h: 0.2667 },
        { x: 0.5095, y: 0.3524, w: 0.4238, h: 0.5809 },
        { x: 0.0667, y: 0.6667, w: 0.4238, h: 0.2667 },
        { x: 0.0667, y: 0.0667, w: 0.4238, h: 0.5809 },
      ],
      // 2番目の配置を90度回転したもの(上の左右反対)。
      [
        { x: 0.5095, y: 0.6667, w: 0.4238, h: 0.2667 },
        { x: 0.5095, y: 0.0667, w: 0.4238, h: 0.5809 },
        { x: 0.0667, y: 0.0667, w: 0.4238, h: 0.2667 },
        { x: 0.0667, y: 0.3524, w: 0.4238, h: 0.5809 },
      ],
      // 縦長の大きな1枚が左、右に小さな3枚。
      [
        { x: 0.0667, y: 0.0667, w: 0.5809, h: 0.8667 },
        { x: 0.6667, y: 0.0667, w: 0.2666, h: 0.2762 },
        { x: 0.6667, y: 0.3619, w: 0.2666, h: 0.2762 },
        { x: 0.6667, y: 0.6571, w: 0.2666, h: 0.2762 },
      ],
      // 縦長の大きな1枚が右、左に小さな3枚。
      [
        { x: 0.3524, y: 0.0667, w: 0.5809, h: 0.8667 },
        { x: 0.0667, y: 0.0667, w: 0.2666, h: 0.2762 },
        { x: 0.0667, y: 0.3619, w: 0.2666, h: 0.2762 },
        { x: 0.0667, y: 0.6571, w: 0.2666, h: 0.2762 },
      ],
    ],
    5: [
      [
        { x: 0.0667, y: 0.1405, w: 0.2762, h: 0.2762 },
        { x: 0.0667, y: 0.4357, w: 0.4238, h: 0.4238 },
        { x: 0.5095, y: 0.4357, w: 0.4238, h: 0.4238 },
        { x: 0.3619, y: 0.1405, w: 0.2762, h: 0.2762 },
        { x: 0.6572, y: 0.1405, w: 0.2762, h: 0.2762 },
      ],
      [
        { x: 0.3619, y: 0.0666, w: 0.5715, h: 0.4239 },
        { x: 0.0667, y: 0.0666, w: 0.2762, h: 0.4239 },
        { x: 0.0667, y: 0.5095, w: 0.2762, h: 0.2024 },
        { x: 0.3619, y: 0.5095, w: 0.5715, h: 0.4239 },
        { x: 0.0667, y: 0.731, w: 0.2762, h: 0.2024 },
      ],
    ],
    6: [
      [
        { x: 0.0667, y: 0.0523, w: 0.4238, h: 0.2857 },
        { x: 0.5095, y: 0.0523, w: 0.4238, h: 0.2886 },
        { x: 0.0667, y: 0.6619, w: 0.4238, h: 0.2857 },
        { x: 0.5095, y: 0.6619, w: 0.4238, h: 0.2886 },
        { x: 0.0667, y: 0.3571, w: 0.4238, h: 0.2857 },
        { x: 0.5095, y: 0.3572, w: 0.4238, h: 0.2886 },
      ],
      [
        { x: 0.0667, y: 0.0667, w: 0.5714, h: 0.4238 },
        { x: 0.0667, y: 0.5095, w: 0.2762, h: 0.4238 },
        { x: 0.6572, y: 0.0667, w: 0.2762, h: 0.2024 },
        { x: 0.6572, y: 0.2881, w: 0.2762, h: 0.2024 },
        { x: 0.6572, y: 0.5095, w: 0.2762, h: 0.4238 },
        { x: 0.3619, y: 0.5095, w: 0.2762, h: 0.4238 },
      ],
    ],
  };

  // Spread (見開き) templates - extracted from the user-provided
  // フォトブックテンプレート(見開き).pptx (7 slides, 42cm x 21cm), plus
  // left-right mirrored versions of slides 6 and 7 (which had no mirrored
  // counterpart in the file already), for 9 variants total. These are
  // distinct from LAYOUT_VARIANTS above because a spread's 2:1 canvas calls
  // for compositions designed around the center gutter rather than just
  // stretching a single-page layout.
  const SPREAD_LAYOUT_VARIANTS = {
    2: [
      [
        { x: 0, y: 0, w: 0.7, h: 1 },
        { x: 0.7286, y: 0.0617, w: 0.2143, h: 0.6287 },
      ],
      [
        { x: 0.3, y: 0, w: 0.7, h: 1 },
        { x: 0.0666, y: 0.0617, w: 0.2143, h: 0.6287 },
      ],
    ],
    3: [
      [
        { x: 0, y: 0, w: 0.6429, h: 1 },
        { x: 0.6762, y: 0.0618, w: 0.2858, h: 0.4286 },
        { x: 0.6762, y: 0.5098, w: 0.2858, h: 0.4286 },
      ],
      [
        { x: 0.3571, y: 0, w: 0.6429, h: 1 },
        { x: 0.038, y: 0.0617, w: 0.2858, h: 0.4286 },
        { x: 0.038, y: 0.5097, w: 0.2858, h: 0.4286 },
      ],
      [
        { x: 0.2857, y: 0, w: 0.7143, h: 1 },
        { x: 0.038, y: 0.0714, w: 0.2143, h: 0.5714 },
        { x: 0.038, y: 0.6619, w: 0.2143, h: 0.2857 },
      ],
      [
        { x: 0, y: 0, w: 0.7143, h: 1 },
        { x: 0.7477, y: 0.0714, w: 0.2143, h: 0.5714 },
        { x: 0.7477, y: 0.6619, w: 0.2143, h: 0.2857 },
      ],
    ],
    4: [
      [
        { x: 0.681, y: 0.0617, w: 0.2857, h: 0.4287 },
        { x: 0.681, y: 0.5095, w: 0.1381, h: 0.4287 },
        { x: 0.8287, y: 0.5108, w: 0.1381, h: 0.4287 },
        { x: 0, y: 0, w: 0.6715, h: 1 },
      ],
      [
        { x: 0, y: 0, w: 0.7143, h: 1 },
        { x: 0.7524, y: 0.0617, w: 0.2143, h: 0.2857 },
        { x: 0.7524, y: 0.3571, w: 0.2143, h: 0.2857 },
        { x: 0.7524, y: 0.6525, w: 0.2143, h: 0.2857 },
      ],
      [
        { x: 0.2857, y: 0, w: 0.7143, h: 1 },
        { x: 0.0333, y: 0.0617, w: 0.2143, h: 0.2857 },
        { x: 0.0333, y: 0.3571, w: 0.2143, h: 0.2857 },
        { x: 0.0333, y: 0.6525, w: 0.2143, h: 0.2857 },
      ],
    ],
    6: [
      [
        { x: 0.0333, y: 0.0667, w: 0.2858, h: 0.4238 },
        { x: 0.0333, y: 0.5095, w: 0.1381, h: 0.2024 },
        { x: 0.181, y: 0.5095, w: 0.1381, h: 0.2 },
        { x: 0.0333, y: 0.731, w: 0.1381, h: 0.2024 },
        { x: 0.181, y: 0.7334, w: 0.1381, h: 0.2 },
        { x: 0.3286, y: 0.0667, w: 0.6381, h: 0.8667 },
      ],
    ],
  };

  // Cover templates (表紙用) - extracted from slides 38/39 of
  // フォトアルバムテンプレート用.pptx. Each reuses the same single full
  // photo placement as LAYOUT_VARIANTS[1][0] and adds fixed title/date text
  // boxes (position, size, font, color extracted exactly from the source
  // slides). These only make sense for single (non-spread) pages, so they
  // are appended to the count=1 catalog only when not in spread mode - see
  // getVariants(). "label" flags them so the picker can show a badge.
  const COVER_TEXT_COLOR = "595959"; // PowerPoint tx1 lumMod65%/lumOff35%
  const COVER_PHOTO_FRAME = { x: 0.0237, y: 0.0332, w: 0.9525, h: 0.7144 };
  const COVER_VARIANTS = [
    {
      label: "表紙(英字1行)",
      frames: [COVER_PHOTO_FRAME],
      texts: [
        { x: 0.1766, y: 0.8024, w: 0.6468, h: 0.0855, text: "title", fontPt: 36, bold: true, color: COVER_TEXT_COLOR, fontFamily: "Amalfi Coast", align: "center" },
        { x: 0.2495, y: 0.9286, w: 0.501, h: 0.0489, text: "DDth Mon. YYYY", fontPt: 18, bold: true, color: COVER_TEXT_COLOR, fontFamily: "Aaargh", align: "center" },
      ],
    },
    {
      label: "表紙(名前+行事)",
      frames: [COVER_PHOTO_FRAME],
      texts: [
        { x: 0.3801, y: 0.8117, w: 0.2407, h: 0.0855, text: "name", fontPt: 36, bold: false, color: COVER_TEXT_COLOR, fontFamily: "Amalfi Coast", align: "center" },
        { x: 0.1321, y: 0.8934, w: 0.7368, h: 0.0448, text: "event", fontPt: 16, bold: false, color: COVER_TEXT_COLOR, fontFamily: "Aaargh", align: "center" },
        { x: 0.2433, y: 0.9382, w: 0.5143, h: 0.0448, text: "DDth Mon. YYYY", fontPt: 16, bold: true, color: COVER_TEXT_COLOR, fontFamily: "Aaargh", align: "center" },
      ],
    },
  ];

  // Back cover (裏表紙) - a fixed logo image with no user photo, extracted
  // from slide40. This isn't a count-based variant at all (no photo slots),
  // so it's applied via the page.backCover flag instead - see state.js.
  const BACK_COVER_IMAGE_RECT = { x: 0.3786, y: 0.3786, w: 0.2429, h: 0.2429 };

  function normalizeVariant(variant) {
    if (Array.isArray(variant)) return { frames: variant, texts: [], label: null };
    return { frames: variant.frames || [], texts: variant.texts || [], label: variant.label || null };
  }

  function getVariants(count, isSpread) {
    if (isSpread) {
      return SPREAD_LAYOUT_VARIANTS[count] || LAYOUT_VARIANTS[count] || LAYOUT_VARIANTS[1];
    }
    if (count === 1) return LAYOUT_VARIANTS[1].concat(COVER_VARIANTS);
    return LAYOUT_VARIANTS[count] || LAYOUT_VARIANTS[1];
  }

  function getLayout(count, variantIndex, isSpread) {
    const variants = getVariants(count, isSpread);
    return normalizeVariant(variants[variantIndex] || variants[0]);
  }

  window.AlbumLayouts = {
    getVariants,
    getLayout,
    normalizeVariant,
    backCoverImageRect: BACK_COVER_IMAGE_RECT,
    coverPhotoFrame: COVER_PHOTO_FRAME,
  };
})();
