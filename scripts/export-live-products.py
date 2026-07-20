#!/usr/bin/env python3
"""Export products from live eltexgroup-ks.com WooCommerce store API."""
import json
import os
import re
import urllib.request
from pathlib import Path

SITE = os.environ.get('ELTEX_SITE', 'https://eltexgroup-ks.com')
OUT = Path(__file__).resolve().parents[1] / 'data' / 'live-products.json'


def html_to_text(html):
    if not html:
        return ''
    text = re.sub(r'<br\s*/?>', '\n', html, flags=re.I)
    text = re.sub(r'</p>', '\n\n', text, flags=re.I)
    text = re.sub(r'<li[^>]*>', '\n• ', text, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return re.sub(r'[ \t]+\n', '\n', text).strip()


def clean_html(html):
    if not html:
        return ''
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.I | re.S)
    html = re.sub(r'on\w+="[^"]*"', '', html, flags=re.I)
    return html.strip()


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    all_products = []
    page = 1
    while True:
        batch = fetch_json(f'{SITE}/wp-json/wc/store/v1/products?per_page=100&page={page}')
        if not batch:
            break
        all_products.extend(batch)
        if len(batch) < 100:
            break
        page += 1

    categories = fetch_json(f'{SITE}/wp-json/wc/store/v1/products/categories?per_page=100')

    export_products = []
    for p in all_products:
        prices = p.get('prices', {})
        raw = prices.get('price', '0')
        minor = prices.get('currency_minor_unit', 2)
        try:
            price = float(raw) / (10 ** minor)
        except (TypeError, ValueError):
            price = 0.0

        images = [img.get('src') for img in p.get('images', []) if img.get('src')]
        image = images[0] if images else ''
        cats = [c.get('name', '') for c in p.get('categories', [])]
        short_html = clean_html(p.get('short_description', ''))
        desc_html = clean_html(p.get('description', ''))
        short = html_to_text(short_html)
        description = html_to_text(desc_html)

        attributes = []
        for attr in p.get('attributes', []):
            terms = attr.get('terms') or []
            value = ', '.join(t.get('name', '') for t in terms if t.get('name'))
            if attr.get('name') and value:
                attributes.append({'name': attr.get('name'), 'value': value})

        export_products.append({
            'id': str(p.get('id')),
            'slug': p.get('slug'),
            'name': p.get('name'),
            'sku': p.get('sku') or '',
            'price': price,
            'currency': prices.get('currency_code', 'EUR'),
            'categories': cats,
            'cat': cats[0] if cats else 'Të Tjera',
            'image': image,
            'images': images,
            'permalink': p.get('permalink'),
            'short_description': short[:800],
            'description': description,
            'short_description_html': short_html,
            'description_html': desc_html or short_html,
            'attributes': attributes,
            'in_stock': bool(p.get('is_in_stock', True)),
        })

    export_categories = [
        {'name': c['name'], 'slug': c.get('slug'), 'count': c.get('count', 0)}
        for c in categories
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({'products': export_products, 'categories': export_categories}, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(f'Exported {len(export_products)} products → {OUT}')


if __name__ == '__main__':
    main()
