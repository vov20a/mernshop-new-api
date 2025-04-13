const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary');

// @desc Login
// @route POST /auth
// @access Public
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const foundUser = await User.findOne({ email }).exec();

  if (!foundUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const match = await bcrypt.compare(password, foundUser.password);

  if (!match) return res.status(401).json({ message: 'Unauthorized' });

  const accessToken = jwt.sign(
    {
      UserInfo: {
        username: foundUser.username,
        email: foundUser.email,
        roles: foundUser.roles,
        id: foundUser.id,
        avatarUrl: foundUser.avatar.url,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' },
  );

  const refreshToken = jwt.sign(
    {
      username: foundUser.username,
      email: foundUser.email,
      id: foundUser.id,
      avatarUrl: foundUser.avatar.url,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

  // Create secure cookie with refresh token
  res.cookie('jwt', refreshToken, {
    httpOnly: true, //accessible only by web server
    secure: true, //https
    sameSite: 'None', //cross-site cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiry: set to match rT
  });

  // Send accessToken containing username and roles
  res.json({ accessToken });
};

// @desc Register
// @route POST /register
// @access Public
const register = async (req, res) => {
  const { username, email, password } = req.body;

  // Confirm data
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check for duplicate username
  const duplicate = await User.findOne({ username })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec();

  if (duplicate) {
    return res.status(409).json({ message: 'Duplicate username' });
  }
  // Check for duplicate email
  const duplicateEmail = await User.findOne({ email }).lean().exec();

  if (duplicateEmail) {
    return res.status(409).json({ message: 'Duplicate email' });
  }

  myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
    folder: 'avatars',
    width: 150,
    crop: 'scale',
  });

  // Hash password
  const hashedPwd = await bcrypt.hash(password, 10); // salt rounds

  let userObject;
  if (req.body.roles) {
    userObject = {
      username,
      email,
      password: hashedPwd,
      avatar: {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      },
      roles: req.body.roles,
    };
  } else
    userObject = {
      username,
      email,
      password: hashedPwd,
      avatar: {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      },
    };

  // Create and store new user
  const user = await User.create(userObject);

  const accessToken = jwt.sign(
    {
      UserInfo: {
        username: user.username,
        email: user.email,
        roles: user.roles,
        id: user.id,
        avatarUrl: user.avatar.url,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' },
  );

  const refreshToken = jwt.sign(
    { username: user.username, email: user.email, id: user.id, avatarUrl: user.avatar.url },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

  // Create secure cookie with refresh token
  res.cookie('jwt', refreshToken, {
    httpOnly: true, //accessible only by web server
    secure: true, //https
    sameSite: 'None', //cross-site cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiry: set to match rT
  });

  // if (user) {
  //   //created
  //   res.status(201).json({ message: `Account: ${username} with ${email} created` });
  // } else {
  //   res.status(400).json({ message: 'Invalid user data received' });
  // }
  res.json({ accessToken });
};

// @desc Refresh
// @route GET /auth/refresh
// @access Public - because access token has expired
const refresh = (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorized' });

  const refreshToken = cookies.jwt;

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });

    const foundUser = await User.findOne({
      username: decoded.username,
      email: decoded.email,
    }).exec();

    if (!foundUser) return res.status(401).json({ message: 'Unauthorized' });

    const accessToken = jwt.sign(
      {
        UserInfo: {
          username: foundUser.username,
          email: foundUser.email,
          roles: foundUser.roles,
          id: foundUser.id,
          avatarUrl: foundUser.avatar.url,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' },
    );

    res.json({ accessToken });
  });
};

// @desc Logout
// @route POST /auth/logout
// @access Public - just to clear cookie if exists
const logout = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); //No content
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
  res.json({ message: 'Cookie cleared' });
};

module.exports = {
  login,
  register,
  refresh,
  logout,
};
