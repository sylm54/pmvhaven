const PLATFORM = "Hypnotube";

var config = {};
var settings = {};
//Source Methods
source.enable = function (conf, sett, savedState) {
  config = conf ?? {};
  settings = sett ?? {};
};

source.setSettings = function(newsettings) {
	settings = newsettings;
}


source.getHome = function () {
  return new FeedPager({mode: "GetTrending"});
};

source.searchSuggestions = function (query) {
  return [];
};
source.getSearchCapabilities = () => {
  return {
    types: [Type.Feed.Mixed],
    sorts: [Type.Order.Chronological],
    filters: [],
  };
};
source.search = function (query, type, order, filters) {
  return new FeedPager({mode: "DefaultSearch", data: query, profile: null});
};
//Video
source.isContentDetailsUrl = function (url) {
  return url.includes("pmvhaven");
};
source.getContentDetails = function (url) {
  return new HVideo(url);
};

class HVideo extends PlatformVideoDetails {
  constructor(url) {
    const json = JSON.parse(url);
    // let res = http.GET(url, {}, false);
    // if (!res.isOk) {
    //   throw new ScriptException("Error trying to load '" + geturl + "'");
    // }
    // let dom = domParser.parseFromString(res.body);
    // let vidurl=dom.querySelector("source").getAttribute("src");
    // let vidname=dom.querySelector(".align-center .pl-2").text;
    log(json.url);
    super({
      id: new PlatformID(PLATFORM, url, config.id),
      name: json.title,
      // thumbnails: new Thumbnails(vid.thumbnailUrl.map((a)=>new Thumbnail(a, 720),)),
      // author:
      //   user != undefined
      //     ? new PlatformAuthorLink(
      //       new PlatformID(PLATFORM, user.getAttribute("href"), config.id), //obj.channel.name, config.id),
      //       user.querySelector(".name").text, //obj.channel.displayName,
      //       user.getAttribute("href"), //obj.channel.url,
      //       "",//
      //       ""
      //     )
      //     : undefined,
      // datetime: Math.round((new Date(ldJson.uploadDate)).getTime() / 1000),
      // duration: flashvars.video_duration,
      // viewCount: views,
      thumbnails: new Thumbnails(json.thumbnails.map((a)=>new Thumbnail(a, 720))),
      url: json.url,
      isLive: false,
      description: json.description,
      video: new VideoSourceDescriptor([
        new VideoUrlSource({
          container: "video/mp4",
          name: "mp4",
          url: json.url,
        }),
      ]),
    });
    let res=http.POST("https://pmvhaven.com/api/v2/videoInput", JSON.stringify({
      mode: "getRecommended",
      profile: null,
      video: json.obj,
    }),{}, false);
    if (!res.isOk) {
      throw new ScriptException("Error trying to load 'https://pmvhaven.com/api/v2/videoInput'");
    }
    const json2 = JSON.parse(res.body);
    if (!json2.recommendedVideos){
      return;
    }
    this.recvids = json2.recommendedVideos.map((a)=>toVideo(a));
    // let recs=res.body.split("video_related=")[1].split("}];")[0]+"}]";
    // this.recvids = JSON.parse(recs).map((a)=>{
    //   let duration = -1;
    //   try {
    //     let time = a.d;
    //     let timenum=parseInt(time.replace("min","").replace("mins",""));
    //     duration = timenum * 60;
    //   } catch (e) { }
    //   return new PlatformVideo({
    //     id: new PlatformID(
    //       "XVideos",
    //       "https://xvideos.com"+a.u,
    //       config.id
    //     ),
    //     name: a.tf,
    //     thumbnails: new Thumbnails([
    //       new Thumbnail(a.ip, 720),
    //     ]),
    //     //   author: new PlatformAuthorLink(
    //     //     new PlatformID("SomePlatformName", "SomeAuthorID", config.id),
    //     //     "SomeAuthorName",
    //     //     "https://platform.com/your/channel/url",
    //     //     "../url/to/thumbnail.png"
    //     //   ),
    //     //   uploadDate: 1696880568,
    //     duration: duration,
    //     //viewCount: parseInt(item.querySelector(".sub-desc").text),
    //     url: "https://xvideos.com"+a.u,
    //     isLive: false,
    // });});
  }

  getContentRecommendations() {
    return new ContentPager(this.recvids, false);
  }
}
source.getContentRecommendations = (url, initialData) => {
  throw new ScriptException("getContentRecommendations");
};

//Comments
source.getComments = function (url) {
  return new CommentPager(
    [
    ],
    false
  );
};
source.getSubComments = function (comment) {
  throw new ScriptException("This is a sample");
};

class FeedPager extends ContentPager {
  constructor(payload) {
    super([], true);
    this.payload = payload;
    this.page = 0;
    this.nextPage();
  }
  nextPage() {
    this.page++;
    const obj= {
      ...this.payload,
      index: this.page,
    }
    let res = undefined;
    res = http.POST("https://pmvhaven.com/api/v2/search", JSON.stringify(obj),{}, false);

    if (!res.isOk) {
      throw new ScriptException("Error trying to load '" + geturl + "'");
    }
    const json = JSON.parse(res.body);
    if (!json.data){
      this.hasMore = false;
      this.results = [];
      return this;
    }
    const out=json.data.map((a)=>toVideo(a));
    this.results = out;
    return this;
  }
}


function toVideo(a) {
return new PlatformVideo({
  id: new PlatformID(
    "PMVHaven",
    a.url,
    config.id
  ),
  name: a.title,
  thumbnails: new Thumbnails(a.thumbnails.filter((b)=>b!="placeholder").map((b)=>new Thumbnail(b, 720))),
  //   author: new PlatformAuthorLink(
  //     new PlatformID("SomePlatformName", "SomeAuthorID", config.id),
  //     "SomeAuthorName",
  //     "https://platform.com/your/channel/url",
  //     "../url/to/thumbnail.png"
  //   ),
  //   uploadDate: 1696880568,
  duration: a.duration,
  viewCount: a.views,
  url: JSON.stringify({
    type: "pmvhaven",
    url: a.url,
    title: a.title,
    description: a.description,
    thumbnails: a.thumbnails.filter((b)=>b!="placeholder"),
    obj:a,
  }),
  isLive: false,
});
}
log("LOADED");
