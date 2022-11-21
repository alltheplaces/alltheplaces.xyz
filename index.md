---
layout: default
---

![Map with points for a recent run of the scrapers](images/overview-map.png)

## Data Downloads

Downloads of the results from all the scrapers:

{% raw %}
<iframe frameborder="no" border="0" width="400" height="100" scrolling="no" src="https://data.alltheplaces.xyz/runs/latest/info_embed.html"></iframe>
{% endraw %}

Other utilities:
* [Check details for the latest build](spiders.html)
* [Browse a map from the latest build](map/)
* [Check Wikidata statistics](wikidata.html)
* [View previous builds](builds.html)

## Format

The linked zip file contains the output of each scraper in a separate
[GeoJSON FeatureCollection](https://tools.ietf.org/html/rfc7946#page-12).
Each [`Feature`](https://tools.ietf.org/html/rfc7946#section-3.2) contains
data about a single scraped item.

Information about the properties contained in each GeoJSON feature are documented [on the project's GitHub repository](https://github.com/alltheplaces/alltheplaces/blob/master/DATA_FORMAT.md).

## License

[![CC-0 Image Mark](https://i.creativecommons.org/p/zero/1.0/88x31.png)](https://creativecommons.org/publicdomain/zero/1.0/)

The downloads provided above and the data contained therein are released under [Creative Commons' CC-0 waiver](https://creativecommons.org/publicdomain/zero/1.0/).

The [spider software](https://github.com/alltheplaces/alltheplaces) that produces this work is licensed under the [MIT license](https://github.com/alltheplaces/alltheplaces/blob/master/LICENSE).
