---
layout: default
---

![Map with points for a recent run of the scrapers](images/overview-map.png)

## Data Downloads

Downloads of the results from all the scrapers:

{% raw %}
<iframe frameborder="no" border="0" width="400" height="100" scrolling="no" src="https://s3.amazonaws.com/placescraper-results/runs/latest/info_embed.html"></iframe>
{% endraw %}

## Format

The linked file is a gzipped [ndjson](http://ndjson.org/) where each line is a [GeoJSON feature](https://tools.ietf.org/html/rfc7946#section-3.2).

Information about the properties contained in each GeoJSON feature are documented [on the project's GitHub repository](https://github.com/alltheplaces/alltheplaces/blob/master/DATA_FORMAT.md).

## License

[![CC-0 Image Mark](https://i.creativecommons.org/p/zero/1.0/88x31.png)](https://creativecommons.org/publicdomain/zero/1.0/)

The downloads provided above and the data contained therein are released under [Creative Commons' CC-0 waiver](https://creativecommons.org/publicdomain/zero/1.0/).

The [spider software](https://github.com/alltheplaces/alltheplaces) that produces this work is licensed under the [MIT license](https://github.com/alltheplaces/alltheplaces/blob/master/LICENSE).
