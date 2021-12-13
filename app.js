const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');


const URL_INFO = {
    Melon : {
        Url : "https://www.melon.com/chart/index.htm",
        BodyList : "div.service_list_song.type02.d_song_list table tbody tr#lst50.lst50 ",
        ElementBodyList : "td div.wrap div.wrap_song_info",
        Element : {
            Name: "div.ellipsis.rank01 span a",
            Singer: "div.ellipsis.rank02 span.checkEllipsis",
            Album: "div.ellipsis.rank03 a",

        },
        AlbumDetail : {
            Url: "https://www.melon.com/album/detail.htm?albumId=",
            BodyList: "div.section_info div.wrap_info div.entry div.meta dl.list",
            Element : {
                PublisherAndAgency: "dd",
                PublisherIndex : 2,
                AgencyInex: 3,
            }
        }
    },
    Genie : {
        Url : "https://www.genie.co.kr/chart/top200",
        BodyList : "div.music-list-wrap table.list-wrap tbody tr.list td.info",
        Element : {
            Name: "a.title.ellipsis",
            Singer: "a.artist.ellipsis",
            Album: "a.albumtitle.ellipsis",
        },
        AlbumDetail : {
            Url: "https://www.genie.co.kr/detail/albumInfo?axnm=",
            BodyList: "div.album-detail-infos div.info-zone ul.info-data",
            Element : {
                PublisherAndAgency: "span.value",
                PublisherIndex : 2,
                AgencyInex: 3,
            }
        }
    },
    Vibe : {
        Url : "https://vibe.naver.com/chart/total",
        BodyList : "div.track_section div div.tracklist table tbody tr",
        Element : {
            Name: "td.song div.title_badge_wrap sap.inner_cell a.link_text",
            Singer: "td.artist span.innder span span a.link_artist span.text",
            Album: "td.album a.link",
        },
        AlbumDetail : {
            Url: "https://vibe.naver.com/album/",
            BodyList: "div.track_section div div.tracklist table tbody tr td.thumb div.inner",
            Element : {
                PublisherAndAgency: "img.img_thumb",
                PublisherIndex : 2,
                AgencyInex: 3,
            }
        }
    },
};

const app = express();

app.get('/', async function(req, res) {
    try {
        const result = {};
        const promiseArr = [];

        for (const [SiteName, Info] of Object.entries(URL_INFO)) {
            result[SiteName] = [];
            const url = Info.Url;

            const response = await getMusicData(url);
            if (!response) {
                console.error('Not found reponse');
                continue;
            }
            const html = response.data;

            const $ = cheerio.load(html);
            const $bodyList = $(Info.BodyList);
            const pList = await $bodyList.map(async function(i, elem) {
                result[SiteName][i] = {};
                let albumDetailLink;
                let name = '';
                let singer = '';
                let album = '';
                switch (SiteName) {
                    case 'Melon':
                        name = $(this).find(Info.ElementBodyList).find(Info.Element.Name).text();
                        singer = $(this).find(Info.ElementBodyList).find(Info.Element.Singer).text();
                        album = $(this).find(Info.ElementBodyList).find(Info.Element.Album).text();
                        albumDetailLink = $(this).find(Info.Element.Album).attr('href');
                        break;
                    case 'Genie':
                        name = $(this).find(Info.Element.Name).text().trim();
                        singer = $(this).find(Info.Element.Singer).text();
                        album = $(this).find(Info.Element.Album).text();
                        albumDetailLink = $(this).find(Info.Element.Album).attr('onclick');
                        break;
                    case 'Vibe':
                        albumDetailLink = $(this).find(Info.Element.Album).attr('src');
                        break;
                    default:
                        break;
                }

                result[SiteName][i].Name = name;
                result[SiteName][i].Singer = singer;
                result[SiteName][i].Album = album;

                try {
                    const deatilResult = await getAlbumDeatilInfo(albumDetailLink, Info.AlbumDetail.Url, Info.AlbumDetail.BodyList, Info.AlbumDetail.Element);
                    if (deatilResult) {
                        result[SiteName][i].Publisher = deatilResult.Publisher;
                        result[SiteName][i].Agency = deatilResult.Agency;
                    }
                } catch (err) {
                    console.error(`getAlbumDeatilInfo result error! SiteName=${SiteName} index=${i} error=${err}`);
                }
            });

            promiseArr.push(...pList);
        }

        await Promise.all(promiseArr).then(() => {
            res.send(result);
        }).catch(err => {
            console.error(`Promise all error! error=${err}`);
        });

    } catch (err) {
        console.error(`error! err=${err}`);
        res.send(`#Request errror #error=${err}`)
    }
});

const getAlbumDeatilInfo = (albumDetailLink, url, bodyList, elementObj) => {
    return new Promise((resolve, reject) => {
        if (!albumDetailLink) {
            reject('#getAlbumDeatilInfo #albumDetailLink is undefined');
            return;
        }

        const albumId = albumDetailLink.match(/\d/g).join("");
        if (!albumId) {
            reject('#getAlbumDeatilInfo #albumId is undefined');
            return;
        }

        getMusicData(url, Number(albumId)).then((response) => {
            if (!response) {
                reject('#getAlbumDeatilInfo #Not found response');
                return;
            }

            const html = response.data;
            const $ = cheerio.load(html);
            const $bodyList = $(bodyList);
            const info = {};
            $bodyList.each(function(i, elem) {
                const infoList = $(this).find(elementObj.PublisherAndAgency).toArray();
                info.Publisher = $(this).find(infoList[elementObj.PublisherIndex]).text();
                info.Agency = $(this).find(infoList[elementObj.AgencyInex]).text();
            });
            resolve(info);
        }).catch(err => {
            reject(`#getAlbumDeatilInfo #error=${err}`);
        });
    });
};

const makeGetUrl = (baseUrl, value) => {
    return `${baseUrl}${value}`
};

const getMusicData = async (url, value=null) => {
    try {
        if (value) {
            url = makeGetUrl(url, value);
        }

        return await axios.get(url);

    } catch (err) {
        console.error(`#getMusicData axios error #error=${err}`);
        return null;
    }
};

app.listen(8080, function(){
    console.log('Server starting on port 8080');
});